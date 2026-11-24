import { and, count, desc, eq, inArray, isNotNull, isNull, lte, sql, sum } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, productVariants, products, storeSettings } from "../../db/schema";

/** Variants at or below this stock are flagged as low. */
export const LOW_STOCK_THRESHOLD = 5;
const REVENUE_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

export async function getSettings() {
  const [s] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1));
  return s ?? null;
}

export async function getDashboard() {
  const [[rev], [pending], [low], [glb], [proc], recent] = await Promise.all([
    db.select({ v: sum(orders.total) }).from(orders).where(inArray(orders.status, [...REVENUE_STATUSES])),
    db.select({ v: count() }).from(orders).where(inArray(orders.status, ["pending", "paid", "processing"])),
    db
      .select({ v: count() })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(lte(productVariants.stock, LOW_STOCK_THRESHOLD), eq(products.isActive, true))),
    db.select({ v: count() }).from(products).where(isNotNull(products.glbUrl)),
    db.select({ v: count() }).from(products).where(and(isNull(products.glbUrl), isNotNull(products.proceduralConfig))),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
  ]);
  return {
    revenue: Number(rev?.v ?? 0),
    pendingOrders: pending?.v ?? 0,
    lowStock: low?.v ?? 0,
    glbAssets: glb?.v ?? 0,
    proceduralAssets: proc?.v ?? 0,
    recent,
  };
}

export async function listOrders(opts: { status?: string; limit?: number } = {}) {
  const rows = await db
    .select({
      order: orders,
      itemCount: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
    })
    .from(orders)
    .where(opts.status ? sql`${orders.status} = ${opts.status}` : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(opts.limit ?? 100);
  return rows.map((r) => ({ ...r.order, itemCount: r.itemCount }));
}

export async function getOrderDetail(id: string) {
  return db.query.orders.findFirst({ where: eq(orders.id, id), with: { items: true } });
}
