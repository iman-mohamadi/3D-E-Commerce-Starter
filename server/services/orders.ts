import { randomInt } from "node:crypto";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { coupons, orderItems, orders, productVariants } from "../../db/schema";
import { ORDER_TRANSITIONS, type OrderStatus } from "../../shared/schemas/admin";
import type { CheckoutInput } from "../../shared/schemas/checkout";
import { getPaymentAdapter } from "../adapters/payment";
import { HttpError } from "../http/errors";
import { priceCart, type AnyDb } from "./pricing";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function candidateNumber(prefix: string, now = new Date()) {
  const d = now.toISOString().slice(0, 10).replaceAll("-", "");
  let s = "";
  for (let i = 0; i < 5; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${d}-${s}`;
}

/** Statuses from which an order can still be cancelled (stock + coupon usage are returned exactly once). */
const CANCELLABLE: OrderStatus[] = ["pending", "paid", "processing"];

export type CreatedOrder = Awaited<ReturnType<typeof createOrder>>;

/**
 * Checkout transaction: re-price from the database, guard stock and coupon usage atomically,
 * generate a collision-safe order number, and write order + snapshotted items. All-or-nothing.
 */
export async function createOrder(exec: AnyDb, input: CheckoutInput, userId: string | null) {
  return exec.transaction(async (tx) => {
    const { quote, settings, couponRow } = await priceCart(tx, input);

    if (!quote.canCheckout) {
      throw new HttpError(409, "Some items in your bag changed. Review them and try again.", { quote });
    }

    // 1) stock: conditional decrement, so two concurrent buyers can never oversell the last unit
    for (const l of quote.lines) {
      const updated = await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${l.quantity}` })
        .where(and(eq(productVariants.id, l.variantId), sql`${productVariants.stock} >= ${l.quantity}`))
        .returning({ id: productVariants.id });
      if (updated.length === 0) throw new HttpError(409, "An item just sold out. Review your bag and try again.", { variantId: l.variantId });
    }

    // 2) coupon usage limit, same pattern
    if (couponRow) {
      const used = await tx
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1` })
        .where(and(eq(coupons.id, couponRow.id), sql`(${coupons.maxUses} IS NULL OR ${coupons.usedCount} < ${coupons.maxUses})`))
        .returning({ id: coupons.id });
      if (used.length === 0) throw new HttpError(409, "This coupon has reached its usage limit.", { coupon: "exhausted" });
    }

    // 3) order number: INSERT .. ON CONFLICT DO NOTHING in a retry loop (a unique violation would abort the transaction)
    let order: typeof orders.$inferSelect | undefined;
    for (let attempt = 0; attempt < 8 && !order; attempt++) {
      [order] = await tx
        .insert(orders)
        .values({
          number: candidateNumber(settings.orderNumberPrefix),
          userId,
          email: input.email,
          status: "pending",
          currency: settings.currency,
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          shippingTotal: quote.shipping.fee,
          total: quote.total,
          couponId: couponRow?.id ?? null,
          couponCode: quote.coupon?.applied ? quote.coupon.code : null,
          shippingAddress: input.shippingAddress,
          paymentProvider: settings.paymentProvider,
          notes: input.notes ?? null,
        })
        .onConflictDoNothing({ target: orders.number })
        .returning();
    }
    if (!order) throw new Error("Could not allocate an order number");

    // 4) snapshot line items
    const items = await tx
      .insert(orderItems)
      .values(
        quote.lines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          variantId: l.variantId,
          title: l.title,
          sku: l.sku,
          colorName: l.colorName,
          size: l.size,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          lineTotal: l.lineTotal,
        })),
      )
      .returning();
    return { order, items, quote };
  });
}

/** pending -> paid (idempotent: only the first caller wins). */
export async function markPaid(exec: AnyDb, orderId: string) {
  const [row] = await exec
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning();
  return row ?? null;
}

/**
 * Cancels an order and returns its stock and coupon use. The status change is a compare-and-set inside
 * the same transaction as the restore, so concurrent or repeated calls restore at most once.
 * Optionally also applies a tracking-number patch.
 */
export async function cancelOrder(exec: AnyDb, orderId: string, extra: Partial<typeof orders.$inferInsert> = {}, only: OrderStatus[] = CANCELLABLE) {
  return exec.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({ ...extra, status: "cancelled" })
      .where(and(eq(orders.id, orderId), inArray(orders.status, only)))
      .returning();
    if (!row) return null; // already cancelled / shipped / not found: nothing to restore

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      if (!it.variantId) continue; // variant was deleted since; nothing to restock
      await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${it.quantity}` })
        .where(eq(productVariants.id, it.variantId));
    }
    if (row.couponId) {
      await tx
        .update(coupons)
        .set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` })
        .where(eq(coupons.id, row.couponId));
    }
    return row;
  });
}

/** Admin status/tracking update with allowed-transition checks and race-safe compare-and-set. */
export async function updateOrderAdmin(exec: AnyDb, id: string, body: { status?: OrderStatus | undefined; trackingNumber?: string | null | undefined }) {
  const [current] = await exec.select().from(orders).where(eq(orders.id, id));
  if (!current) throw new HttpError(404, "Order not found");

  const patch: Partial<typeof orders.$inferInsert> = {};
  if (body.trackingNumber !== undefined) patch.trackingNumber = body.trackingNumber || null;

  const target = body.status && body.status !== current.status ? body.status : null;
  if (target) {
    if (!ORDER_TRANSITIONS[current.status].includes(target)) {
      throw new HttpError(409, `Cannot move an order from "${current.status}" to "${target}"`);
    }
    if (target === "shipped" && !(patch.trackingNumber ?? current.trackingNumber)) {
      throw new HttpError(422, "Add a tracking number before marking an order as shipped");
    }
    if (target === "cancelled") {
      const row = await cancelOrder(exec, id, patch);
      if (!row) throw new HttpError(409, "This order can no longer be cancelled");
      return row;
    }
    const [row] = await exec
      .update(orders)
      .set({ ...patch, status: target })
      .where(and(eq(orders.id, id), eq(orders.status, current.status)))
      .returning();
    if (!row) throw new HttpError(409, "The order changed while you were editing it. Reload and try again.");
    return row;
  }
  if (Object.keys(patch).length) await exec.update(orders).set(patch).where(eq(orders.id, id));
  return { ...current, ...patch };
}

/** Starts payment with the store's configured provider. Failure cancels the order and restores stock. */
export async function startPayment(exec: AnyDb, order: typeof orders.$inferSelect, returnUrl: string) {
  try {
    const adapter = getPaymentAdapter(order.paymentProvider);
    const res = await adapter.createPayment({ orderId: order.id, orderNumber: order.number, amount: order.total, currency: order.currency, customerEmail: order.email, returnUrl });
    await exec.update(orders).set({ paymentReference: res.reference }).where(eq(orders.id, order.id));
    if (res.status === "paid") await markPaid(exec, order.id);
    if (res.status === "failed") await cancelOrder(exec, order.id, {}, ["pending"]);
    return res;
  } catch (e) {
    await cancelOrder(exec, order.id, {}, ["pending"]);
    console.error("payment initiation failed", e);
    throw new HttpError(502, "Payment could not be started. You have not been charged; please try again.");
  }
}

export type PaymentOutcome = "paid" | "failed" | "pending" | "noop";

/** Handles the customer returning from the gateway: verify server-side, then mark paid or cancel (idempotent). */
export async function finalizePayment(exec: AnyDb, order: typeof orders.$inferSelect, params: Record<string, string>): Promise<PaymentOutcome> {
  if (order.status !== "pending") return "noop";
  if (!order.paymentReference) return "pending";
  const adapter = getPaymentAdapter(order.paymentProvider);
  const res = await adapter.verifyPayment({ reference: order.paymentReference, params, expectedAmount: order.total });
  if (res.status === "paid") {
    await markPaid(exec, order.id);
    return "paid";
  }
  if (res.status === "failed") {
    await cancelOrder(exec, order.id, {}, ["pending"]);
    return "failed";
  }
  return "pending";
}

/**
 * Pending-order expiry sweeper. Cancels unpaid `pending` orders older than `ttlMinutes` through cancelOrder(),
 * so held stock and coupon uses are released atomically. The compare-and-set is restricted to `pending`, so an
 * order that was paid a moment ago is never touched, and running the sweeper concurrently or repeatedly is safe.
 */
export async function expirePendingOrders(exec: AnyDb, ttlMinutes: number, opts: { limit?: number; now?: Date } = {}) {
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) throw new Error("ttlMinutes must be a positive number");
  const cutoff = new Date((opts.now ?? new Date()).getTime() - ttlMinutes * 60_000);
  const stale = await exec
    .select({ id: orders.id, number: orders.number })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)))
    .orderBy(asc(orders.createdAt))
    .limit(opts.limit ?? 500);

  const expired: string[] = [];
  for (const o of stale) {
    const row = await cancelOrder(exec, o.id, {}, ["pending"]);
    if (row) expired.push(o.number);
  }
  return { expired: expired.length, numbers: expired };
}
