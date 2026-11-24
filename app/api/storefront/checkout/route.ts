import { NextResponse } from "next/server";
import { checkoutInput } from "@/shared/schemas/checkout";
import { db } from "@/db/client";
import { currentUser } from "@/server/auth/guards";
import { handle, parseJson } from "@/server/http/errors";
import { createOrder, startPayment } from "@/server/services/orders";
import { orderToken } from "@/server/services/order-access";

/**
 * Server-validated checkout. Body: items (variantId + quantity), coupon, contact + address.
 * Transaction: re-price, guard stock + coupon, number the order, snapshot items. Then payment starts with the
 * configured provider; the response tells the browser where to go (gateway page or confirmation).
 */
export const POST = handle(async (req: Request) => {
  const input = await parseJson(req, checkoutInput);
  const user = await currentUser(); // optional: guests may check out
  const { order } = await createOrder(db, input, user?.id ?? null);

  const origin = new URL(req.url).origin;
  const returnUrl = `${origin}/api/storefront/payments/return?order=${encodeURIComponent(order.number)}`;
  const payment = await startPayment(db, order, returnUrl);

  const token = orderToken(order.number, order.email);
  const confirmUrl = `/checkout/confirm/${encodeURIComponent(order.number)}?token=${token}`;
  return NextResponse.json({ orderNumber: order.number, redirectUrl: payment.redirectUrl ?? confirmUrl }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
