/** Pure pricing rules shared by the quote API and the checkout transaction (single source of truth). */

export const MAX_LINE_QTY = 10;

export interface CouponRule {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
}

export type CouponProblem = "not_found" | "inactive" | "not_started" | "expired" | "min_subtotal" | "exhausted";

export type CouponCheck = { ok: true; discount: number } | { ok: false; reason: CouponProblem };

/** Validates a coupon against a subtotal and returns the discount (never more than the subtotal). */
export function checkCoupon(c: CouponRule | null | undefined, subtotal: number, now = new Date()): CouponCheck {
  if (!c) return { ok: false, reason: "not_found" };
  if (!c.isActive) return { ok: false, reason: "inactive" };
  if (c.startsAt && c.startsAt > now) return { ok: false, reason: "not_started" };
  if (c.expiresAt && c.expiresAt <= now) return { ok: false, reason: "expired" };
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return { ok: false, reason: "exhausted" };
  if (subtotal < c.minSubtotal) return { ok: false, reason: "min_subtotal" };
  const raw = c.type === "percent" ? Math.floor((subtotal * c.value) / 100) : c.value;
  return { ok: true, discount: Math.max(0, Math.min(raw, subtotal)) };
}

export interface ShippingRules {
  flatShippingRate: number;
  freeShippingThreshold: number | null;
}

export interface ShippingResult {
  fee: number;
  isFree: boolean;
  freeThreshold: number | null;
  /** Minor units still needed for free shipping (0 once reached, null if the store has no threshold). */
  remainingForFree: number | null;
}

/** Free shipping is judged on the post-discount merchandise total. */
export function shippingFor(merchandiseTotal: number, s: ShippingRules): ShippingResult {
  const free = s.freeShippingThreshold !== null && merchandiseTotal >= s.freeShippingThreshold;
  return {
    fee: free || merchandiseTotal <= 0 ? 0 : s.flatShippingRate,
    isFree: free,
    freeThreshold: s.freeShippingThreshold,
    remainingForFree: s.freeShippingThreshold === null ? null : Math.max(0, s.freeShippingThreshold - merchandiseTotal),
  };
}
