import { eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schemaNs from "../../db/schema";
import { coupons, productVariants, products, storeSettings } from "../../db/schema";
import { MAX_LINE_QTY, checkCoupon, shippingFor } from "../../shared/pricing";
import { DELIVERY_METHODS, type LineStatus, type QuoteCoupon, type QuoteLine, type QuoteResponse } from "../../shared/schemas/checkout";
import { storage } from "../adapters/storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<any, typeof schemaNs>;

export interface PricingInput {
  items: { variantId: string; quantity: number }[];
  couponCode?: string | undefined;
}

export type StoreRow = typeof storeSettings.$inferSelect;
export type CouponRow = typeof coupons.$inferSelect;

function imageUrl(k: string | null): string | null {
  if (!k) return null;
  return /^(https?:)?\/\//.test(k) || k.startsWith("/") ? k : storage().publicUrl(k);
}

/**
 * The only place prices are computed. Re-reads active products, variants, coupon and store settings,
 * so nothing the browser sends (prices, totals, stock) is trusted. Used by both /cart/quote and checkout.
 */
export async function priceCart(exec: AnyDb, input: PricingInput) {
  const [settings] = await exec.select().from(storeSettings).where(eq(storeSettings.id, 1));
  if (!settings) throw new Error("Store settings are missing");

  // merge duplicate lines, keep first-seen order
  const wanted = new Map<string, number>();
  for (const it of input.items) wanted.set(it.variantId, Math.min(MAX_LINE_QTY, (wanted.get(it.variantId) ?? 0) + it.quantity));

  const rows = wanted.size
    ? await exec
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          colorName: productVariants.colorName,
          colorHex: productVariants.colorHex,
          size: productVariants.size,
          stock: productVariants.stock,
          priceDelta: productVariants.priceDelta,
          productId: products.id,
          title: products.title,
          slug: products.slug,
          basePrice: products.basePrice,
          isActive: products.isActive,
          image: products.fallbackImageUrl,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, [...wanted.keys()]))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines: QuoteLine[] = [];
  for (const [variantId, requested] of wanted) {
    const r = byId.get(variantId);
    if (!r || !r.isActive) {
      // unknown / deactivated: priced at 0 so it never reaches totals
      lines.push({ variantId, productId: r?.productId ?? "", productSlug: r?.slug ?? "", title: r?.title ?? "", sku: r?.sku ?? "", colorName: r?.colorName ?? "", colorHex: r?.colorHex ?? "#000000", size: r?.size ?? "", image: null, unitPrice: 0, requestedQuantity: requested, quantity: 0, maxQuantity: 0, status: "unavailable", lineTotal: 0 });
      continue;
    }
    const maxQuantity = Math.max(0, Math.min(r.stock, MAX_LINE_QTY));
    const status: LineStatus = r.stock <= 0 ? "out_of_stock" : r.stock < requested ? "reduced" : "ok";
    const quantity = Math.min(requested, maxQuantity);
    const unitPrice = r.basePrice + r.priceDelta;
    lines.push({ variantId, productId: r.productId, productSlug: r.slug, title: r.title, sku: r.sku, colorName: r.colorName, colorHex: r.colorHex, size: r.size, image: imageUrl(r.image), unitPrice, requestedQuantity: requested, quantity, maxQuantity, status, lineTotal: unitPrice * quantity });
  }

  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);

  let couponRow: CouponRow | null = null;
  let coupon: QuoteCoupon | null = null;
  let discountTotal = 0;
  if (input.couponCode) {
    const code = input.couponCode.toUpperCase();
    [couponRow = null] = await exec.select().from(coupons).where(eq(coupons.code, code));
    const check = checkCoupon(couponRow, subtotal);
    if (check.ok) {
      discountTotal = check.discount;
      coupon = { code, applied: true, discount: check.discount };
    } else {
      coupon = { code, applied: false, reason: check.reason, discount: 0, ...(check.reason === "min_subtotal" && couponRow ? { minSubtotal: couponRow.minSubtotal } : {}) };
      couponRow = null;
    }
  }

  const merchandise = subtotal - discountTotal;
  const shipping = shippingFor(merchandise, settings);
  const quote: QuoteResponse = {
    currency: settings.currency,
    lines,
    subtotal,
    coupon,
    discountTotal,
    shipping: { fee: shipping.fee, isFree: shipping.isFree, freeThreshold: shipping.freeThreshold, remainingForFree: shipping.remainingForFree },
    deliveryMethods: DELIVERY_METHODS.map((id) => ({ id, fee: shipping.fee })),
    total: merchandise + shipping.fee,
    canCheckout: lines.length > 0 && lines.every((l) => l.status === "ok") && (!coupon || coupon.applied),
  };
  return { quote, settings, couponRow };
}
