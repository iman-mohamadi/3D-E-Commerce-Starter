import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { orderLookupInput } from "@/shared/schemas/checkout";
import { HttpError, handle, parseJson } from "@/server/http/errors";
import { orderToken } from "@/server/services/order-access";
import { clientIp, enforceRateLimit } from "@/server/security/rate-limit";
import { LIMITS } from "@/server/security/policies";

/** Guest order lookup: order number + the email used at checkout gives an access token for the confirmation page. */
export const POST = handle(async (req: Request) => {
  await enforceRateLimit(LIMITS.orderLookupIp, clientIp(req));
  const { orderNumber, email } = await parseJson(req, orderLookupInput);
  await enforceRateLimit(LIMITS.orderLookupOrder, orderNumber);
  const [order] = await db.select({ number: orders.number, email: orders.email }).from(orders).where(eq(orders.number, orderNumber));
  // same answer whether the number or the email is wrong
  if (!order || order.email.toLowerCase() !== email) throw new HttpError(404, "We could not find an order with those details");
  return NextResponse.json({ token: orderToken(order.number, order.email) }, { headers: { "Cache-Control": "no-store" } });
});
