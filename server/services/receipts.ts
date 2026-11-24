import type { ReceiptOrder } from "../../storefront/components/OrderReceipt";
import type { orderItems, orders } from "../../db/schema";

type OrderWithItems = typeof orders.$inferSelect & { items: (typeof orderItems.$inferSelect)[] };

/** Serialisable customer-facing view of an order (dates as ISO strings; no payment internals). */
export function toReceipt(o: OrderWithItems): ReceiptOrder {
  return {
    number: o.number,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    email: o.email,
    subtotal: o.subtotal,
    discountTotal: o.discountTotal,
    shippingTotal: o.shippingTotal,
    total: o.total,
    couponCode: o.couponCode,
    trackingNumber: o.trackingNumber,
    shippingAddress: o.shippingAddress,
    items: o.items.map((i) => ({ id: i.id, title: i.title, sku: i.sku, colorName: i.colorName, size: i.size, unitPrice: i.unitPrice, quantity: i.quantity, lineTotal: i.lineTotal })),
  };
}
