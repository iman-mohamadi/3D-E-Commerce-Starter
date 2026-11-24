import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, timestamps } from "./_common";
import { users } from "./users";
import { productVariants, products } from "./catalog";
import type { Address } from "../../shared/schemas/json";

export const orderStatus = pgEnum("order_status", [
  "pending", // created, awaiting payment
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const couponType = pgEnum("coupon_type", ["percent", "fixed"]);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: text("code").notNull(), // stored upper-case
    type: couponType("type").notNull(),
    /** percent: 1-100 / fixed: minor units */
    value: integer("value").notNull(),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("coupons_code_uq").on(t.code),
    check("coupons_value_positive", sql`${t.value} > 0`),
    check("coupons_percent_range", sql`${t.type} <> 'percent' OR ${t.value} <= 100`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    /** Human-friendly number shown to customers, e.g. "AT-100234". */
    number: text("number").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: orderStatus("status").notNull().default("pending"),
    currency: text("currency").notNull(),
    subtotal: integer("subtotal").notNull(),
    discountTotal: integer("discount_total").notNull().default(0),
    shippingTotal: integer("shipping_total").notNull().default(0),
    total: integer("total").notNull(),
    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    couponCode: text("coupon_code"),
    shippingAddress: jsonb("shipping_address").$type<Address>().notNull(),
    paymentProvider: text("payment_provider").notNull(),
    paymentReference: text("payment_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.number),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    uniqueIndex("orders_payment_ref_uq").on(t.paymentProvider, t.paymentReference),
  ],
);

/** Line items snapshot title/price/options so history survives catalog edits. */
export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    sku: text("sku").notNull(),
    colorName: text("color_name").notNull(),
    size: text("size").notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_qty_positive", sql`${t.quantity} > 0`)],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
