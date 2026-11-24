/**
 * End-to-end check of the money-critical backend logic against a real (in-memory) Postgres.
 *   npm run verify:checkout
 * Runs the committed SQL migrations, seeds the demo store, then exercises pricing, checkout, overselling,
 * cancellation restore, payment finalisation and order numbers.
 */
process.env.DATABASE_URL ??= "postgres://unused";
process.env.AUTH_SECRET ??= "verify-script-secret-0123456789abcdef0123456789";
process.env.STORAGE_LOCAL_DIR ??= ".uploads-verify";

import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";
import { DARK_ATELIER_PRESET, SEED_COLLECTION, SEED_COUPONS, SEED_PRODUCTS, SEED_SETTINGS, variantRowsFor } from "../db/seed/data";

const { priceCart } = await import("../server/services/pricing");
const { cancelOrder, createOrder, finalizePayment, markPaid, startPayment, updateOrderAdmin } = await import("../server/services/orders");
const { orderToken, verifyOrderToken } = await import("../server/services/order-access");
const { checkCoupon, shippingFor } = await import("../shared/pricing");
const { HttpError } = await import("../server/http/errors");
const { expirePendingOrders } = await import("../server/services/orders");
const { MemoryRateLimiter, enforceRateLimit, clientIp } = await import("../server/security/rate-limit");
const { applyBrand } = await import("../server/services/brand");
const { verifyPassword } = await import("../server/auth/password");

const client = new PGlite();
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: "./drizzle" });

// ---- seed (same data as `npm run db:seed`)
await db.insert(schema.studioPresets).values(DARK_ATELIER_PRESET);
await db.insert(schema.storeSettings).values({ id: 1, ...SEED_SETTINGS, studioThemePreset: DARK_ATELIER_PRESET.slug, orderNumberPrefix: "ATL" });
const [rack] = await db.insert(schema.collections).values(SEED_COLLECTION).returning();
for (const p of SEED_PRODUCTS) {
  const [row] = await db
    .insert(schema.products)
    .values({ title: p.title, slug: p.slug, description: p.description, basePrice: p.basePrice, collectionId: rack!.id, rackPosition: p.rackPosition, transformConfig: p.transform, proceduralConfig: p.procedural, sizeGuide: p.sizeGuide })
    .returning();
  await db.insert(schema.productVariants).values(variantRowsFor(p).map((v) => ({ ...v, productId: row!.id })));
}
await db.insert(schema.coupons).values(SEED_COUPONS);

const variant = async (sku: string) => (await db.select().from(schema.productVariants).where(eq(schema.productVariants.sku, sku)))[0]!;
const stock = async (sku: string) => (await variant(sku)).stock;
const coupon = async (code: string) => (await db.select().from(schema.coupons).where(eq(schema.coupons.code, code)))[0]!;

const address = { fullName: "Test Buyer", phone: "+10000000000", line1: "1 Test Street", city: "Testville", postalCode: "12345", country: "US" };
const checkout = (items: { variantId: string; quantity: number }[], couponCode?: string) => ({ items, couponCode, email: "buyer@example.com", shippingAddress: address, deliveryMethod: "standard" as const });

let n = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`  ok ${++n}. ${name}`);
};

const tee = await variant("TEE-ONX-M"); // $85.00, stock 20
const hoodie = await variant("HOD-OXB-M"); // $165 + $10 delta, stock 14
const coat = await variant("COA-CHR-XL"); // $380, stock 2

await test("pure rules: coupon + shipping", async () => {
  const base = { code: "X", type: "percent" as const, value: 10, minSubtotal: 5000, maxUses: 1, usedCount: 0, startsAt: null, expiresAt: null, isActive: true };
  assert.deepEqual(checkCoupon(base, 10000), { ok: true, discount: 1000 });
  assert.deepEqual(checkCoupon(base, 100), { ok: false, reason: "min_subtotal" });
  assert.deepEqual(checkCoupon({ ...base, usedCount: 1 }, 10000), { ok: false, reason: "exhausted" });
  assert.deepEqual(checkCoupon({ ...base, expiresAt: new Date(0) }, 10000), { ok: false, reason: "expired" });
  assert.deepEqual(checkCoupon({ ...base, type: "fixed", value: 99999 }, 10000), { ok: true, discount: 10000 }, "fixed discount is capped at subtotal");
  assert.equal(shippingFor(19999, { flatShippingRate: 1200, freeShippingThreshold: 20000 }).fee, 1200);
  assert.equal(shippingFor(20000, { flatShippingRate: 1200, freeShippingThreshold: 20000 }).isFree, true);
});

await test("quote: live prices, coupon, shipping, ignores client-side claims", async () => {
  const { quote } = await priceCart(db, { items: [{ variantId: tee.id, quantity: 2 }], couponCode: "WELCOME10" });
  assert.equal(quote.subtotal, 17000);
  assert.equal(quote.discountTotal, 1700);
  assert.equal(quote.shipping.fee, 1200);
  assert.equal(quote.shipping.remainingForFree, 20000 - 15300);
  assert.equal(quote.total, 15300 + 1200);
  assert.equal(quote.canCheckout, true);
  const h = (await priceCart(db, { items: [{ variantId: hoodie.id, quantity: 1 }] })).quote;
  assert.equal(h.lines[0]!.unitPrice, 17500, "base_price + price_delta");
  assert.equal(h.shipping.isFree, false);
});

await test("quote: unknown variant, capped stock, bad coupon", async () => {
  const { quote } = await priceCart(db, { items: [{ variantId: coat.id, quantity: 5 }, { variantId: crypto.randomUUID(), quantity: 1 }], couponCode: "NOPE" });
  assert.equal(quote.lines[0]!.status, "reduced");
  assert.equal(quote.lines[0]!.quantity, 2);
  assert.equal(quote.lines[1]!.status, "unavailable");
  assert.equal(quote.coupon?.applied, false);
  assert.equal(quote.coupon?.reason, "not_found");
  assert.equal(quote.canCheckout, false);
});

let order1!: Awaited<ReturnType<typeof createOrder>>["order"];
await test("checkout: order number, snapshot items, stock deducted, coupon counted", async () => {
  const before = await stock(tee.sku);
  const res = await createOrder(db, checkout([{ variantId: tee.id, quantity: 2 }], "ATELIER25"), null);
  order1 = res.order;
  assert.match(order1.number, /^ATL-\d{8}-[A-Z2-9]{5}$/);
  assert.equal(order1.status, "pending");
  assert.equal(order1.subtotal, 17000);
  assert.equal(order1.discountTotal, 2500); // fixed 25.00 (min subtotal 150.00 met)
  assert.equal(order1.total, 17000 - 2500 + 1200);
  assert.equal(res.items[0]!.sku, tee.sku);
  assert.equal(res.items[0]!.colorName, "Onyx");
  assert.equal(res.items[0]!.unitPrice, 8500);
  assert.equal(await stock(tee.sku), before - 2);
  assert.equal((await coupon("ATELIER25")).usedCount, 1);
});

await test("checkout: rejects when stock is insufficient and changes nothing", async () => {
  const before = await stock(coat.sku);
  await assert.rejects(createOrder(db, checkout([{ variantId: tee.id, quantity: 1 }, { variantId: coat.id, quantity: 5 }]), null), (e) => e instanceof HttpError && e.status === 409);
  assert.equal(await stock(coat.sku), before);
  assert.equal(await stock(tee.sku), 18, "the tee line was rolled back with the failed transaction");
});

await test("checkout: last unit cannot be sold twice (race)", async () => {
  await db.update(schema.productVariants).set({ stock: 1 }).where(eq(schema.productVariants.id, coat.id));
  const results = await Promise.allSettled([createOrder(db, checkout([{ variantId: coat.id, quantity: 1 }]), null), createOrder(db, checkout([{ variantId: coat.id, quantity: 1 }]), null)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await stock(coat.sku), 0);
});

await test("checkout: coupon usage limit is enforced", async () => {
  await db.update(schema.coupons).set({ maxUses: 1, usedCount: 0 }).where(eq(schema.coupons.code, "WELCOME10"));
  await createOrder(db, checkout([{ variantId: hoodie.id, quantity: 1 }], "WELCOME10"), null);
  const stockAfterFirst = await stock(hoodie.sku);
  await assert.rejects(createOrder(db, checkout([{ variantId: hoodie.id, quantity: 1 }], "WELCOME10"), null), (e) => e instanceof HttpError && e.status === 409);
  assert.equal(await stock(hoodie.sku), stockAfterFirst);
});

await test("cancel: restores stock + coupon exactly once", async () => {
  const stockBefore = await stock(tee.sku);
  const first = await cancelOrder(db, order1.id);
  const second = await cancelOrder(db, order1.id);
  assert.equal(first?.status, "cancelled");
  assert.equal(second, null);
  assert.equal(await stock(tee.sku), stockBefore + 2);
  assert.equal((await coupon("ATELIER25")).usedCount, 0);
});

await test("admin: transitions, shipped needs tracking, cancelled restores once", async () => {
  const { order } = await createOrder(db, checkout([{ variantId: tee.id, quantity: 3 }]), null);
  const base = await stock(tee.sku);
  await assert.rejects(updateOrderAdmin(db, order.id, { status: "shipped" }), (e) => e instanceof HttpError && e.status === 409);
  await updateOrderAdmin(db, order.id, { status: "processing" });
  await assert.rejects(updateOrderAdmin(db, order.id, { status: "shipped" }), (e) => e instanceof HttpError && e.status === 422);
  await updateOrderAdmin(db, order.id, { trackingNumber: "TRK123" });
  await updateOrderAdmin(db, order.id, { status: "cancelled" });
  assert.equal(await stock(tee.sku), base + 3);
  await updateOrderAdmin(db, order.id, { status: "cancelled" }); // repeated cancel is a harmless no-op
  assert.equal(await stock(tee.sku), base + 3, "second cancel restored nothing");
  await assert.rejects(updateOrderAdmin(db, order.id, { status: "processing" }), (e) => e instanceof HttpError && e.status === 409, "cancelled is terminal");
});

await test("payment: mock gateway redirect -> verify -> paid (idempotent)", async () => {
  const { order } = await createOrder(db, checkout([{ variantId: tee.id, quantity: 1 }]), null);
  const pay = await startPayment(db, order, "http://localhost:3000/api/storefront/payments/return?order=" + order.number);
  assert.equal(pay.status, "pending");
  assert.ok(pay.redirectUrl?.includes("/checkout/mock-pay"));
  const [fresh] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
  assert.equal(fresh!.paymentReference, pay.reference);
  assert.equal(await finalizePayment(db, fresh!, { mock_status: "paid" }), "paid");
  const [paid] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
  assert.equal(paid!.status, "paid");
  assert.ok(paid!.paidAt);
  assert.equal(await finalizePayment(db, paid!, { mock_status: "failed" }), "noop", "a paid order can't be failed by replaying the return URL");
  assert.equal(await markPaid(db, order.id), null);
});

await test("payment: failed payment cancels the order and restores stock", async () => {
  const before = await stock(tee.sku);
  const { order } = await createOrder(db, checkout([{ variantId: tee.id, quantity: 2 }]), null);
  assert.equal(await stock(tee.sku), before - 2);
  await startPayment(db, order, "http://localhost:3000/api/storefront/payments/return?order=" + order.number);
  const [fresh] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
  assert.equal(await finalizePayment(db, fresh!, { mock_status: "failed" }), "failed");
  assert.equal(await stock(tee.sku), before);
});

await test("order numbers are unique across many orders; guest tokens verify", async () => {
  await db.update(schema.productVariants).set({ stock: 1000 }).where(eq(schema.productVariants.id, tee.id));
  const numbers = new Set<string>();
  for (let i = 0; i < 25; i++) numbers.add((await createOrder(db, checkout([{ variantId: tee.id, quantity: 1 }]), null)).order.number);
  assert.equal(numbers.size, 25);
  const [num] = [...numbers];
  const t = orderToken(num!, "Buyer@Example.com");
  assert.equal(verifyOrderToken(num!, "buyer@example.com", t), true);
  assert.equal(verifyOrderToken(num!, "other@example.com", t), false);
  assert.equal(verifyOrderToken(num!, "buyer@example.com", "bogus"), false);
});

await test("rate limiter: sliding window, Retry-After, reset, per-key isolation", async () => {
  let t = 1_000_000;
  const lim = new MemoryRateLimiter({ now: () => t });
  const rule = { name: "t", limit: 3, windowMs: 10_000 };
  for (let i = 0; i < 3; i++) await enforceRateLimit(rule, "ip-a", lim);
  await assert.rejects(enforceRateLimit(rule, "ip-a", lim), (e) => e instanceof HttpError && e.status === 429 && e.headers?.["Retry-After"] === "10");
  await enforceRateLimit(rule, "ip-b", lim); // other callers are unaffected
  t += 4_000;
  await assert.rejects(enforceRateLimit(rule, "ip-a", lim), (e) => e instanceof HttpError && e.headers?.["Retry-After"] === "6");
  t += 6_001; // the oldest hits slide out of the window
  await enforceRateLimit(rule, "ip-a", lim);
  const one = { name: "r", limit: 1, windowMs: 1000 };
  const small = new MemoryRateLimiter({ now: () => t });
  await enforceRateLimit(one, "x", small);
  await assert.rejects(enforceRateLimit(one, "x", small));
  const { resetRateLimit } = await import("../server/security/rate-limit");
  await resetRateLimit(one, "x", small);
  await enforceRateLimit(one, "x", small);
  assert.equal(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } })), "203.0.113.9");
});

await test("expiry sweeper: cancels only stale pending orders, restores stock + coupon once", async () => {
  await db.update(schema.productVariants).set({ stock: 100 }).where(eq(schema.productVariants.id, tee.id));
  await db.update(schema.coupons).set({ maxUses: null, usedCount: 0 }).where(eq(schema.coupons.code, "ATELIER25"));
  const old = new Date(Date.now() - 90 * 60_000);
  const stale = (await createOrder(db, checkout([{ variantId: tee.id, quantity: 3 }], "ATELIER25"), null)).order;
  const stalePaid = (await createOrder(db, checkout([{ variantId: tee.id, quantity: 2 }]), null)).order;
  const fresh = (await createOrder(db, checkout([{ variantId: tee.id, quantity: 1 }]), null)).order;
  await markPaid(db, stalePaid.id);
  await db.update(schema.orders).set({ createdAt: old }).where(eq(schema.orders.id, stale.id));
  await db.update(schema.orders).set({ createdAt: old }).where(eq(schema.orders.id, stalePaid.id));
  assert.equal(await stock(tee.sku), 100 - 6);
  assert.equal((await coupon("ATELIER25")).usedCount, 1);

  const res = await expirePendingOrders(db, 30);
  assert.deepEqual(res.numbers, [stale.number]);
  assert.equal(await stock(tee.sku), 100 - 6 + 3, "only the stale pending order's stock came back");
  assert.equal((await coupon("ATELIER25")).usedCount, 0);
  const status = async (id: string) => (await db.select().from(schema.orders).where(eq(schema.orders.id, id)))[0]!.status;
  assert.equal(await status(stale.id), "cancelled");
  assert.equal(await status(stalePaid.id), "paid", "a paid order is never expired, even if old");
  assert.equal(await status(fresh.id), "pending", "recent pending orders are kept");

  const again = await expirePendingOrders(db, 30);
  assert.equal(again.expired, 0);
  assert.equal(await stock(tee.sku), 100 - 6 + 3, "running the sweeper again restores nothing");
  const later = await expirePendingOrders(db, 30, { now: new Date(Date.now() + 31 * 60_000) });
  assert.ok(later.numbers.includes(fresh.number), "once past the TTL the fresh order expires too");
  assert.equal(await status(fresh.id), "cancelled");
  assert.equal(await status(stalePaid.id), "paid");
  await assert.rejects(expirePendingOrders(db, 0));
});

await test("brand bootstrap: settings + locale defaults + admin rotation", async () => {
  await db.insert(schema.users).values({ email: "old-admin@example.com", passwordHash: "x", role: "admin" });
  const res = await applyBrand(db, { brandName: "Rosa Mode", locale: "fa", currency: "irr", orderPrefix: "rosa", accent: "#ff8899", admin: { email: "owner@rosa.example" } }, { generatePassword: () => "generated-pass-123" });
  const [s] = await db.select().from(schema.storeSettings);
  assert.equal(s!.brandName, "Rosa Mode");
  assert.equal(s!.defaultLocale, "fa");
  assert.equal(s!.direction, "rtl", "fa implies RTL");
  assert.equal(s!.currency, "IRR");
  assert.equal(s!.currencyDecimals, 0, "IRR has no minor unit");
  assert.equal(s!.orderNumberPrefix, "ROSA");
  assert.equal(s!.brandTheme.accent, "#ff8899");
  assert.equal(s!.brandTheme.background, SEED_SETTINGS.brandTheme.background, "unspecified theme colours are kept");
  assert.equal(res.admin?.email, "owner@rosa.example");
  assert.equal(res.admin?.password, "generated-pass-123");
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.email, "owner@rosa.example"));
  assert.equal(await verifyPassword("generated-pass-123", admin!.passwordHash), true);
  await assert.rejects(applyBrand(db, { orderPrefix: "bad prefix!" }));
  await assert.rejects(applyBrand(db, { paymentProvider: "not-registered" }), /not registered/);
  await applyBrand(db, { paymentProvider: "mock" });
});

console.log(`\nAll ${n} checks passed.`);
await client.close();
process.exit(0);
