import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { orderToken } from "@/server/services/order-access";
import { finalizePayment } from "@/server/services/orders";

/**
 * Where the payment gateway sends the customer back (GET). Verifies with the provider server-side,
 * marks the order paid or cancels it (restoring stock), then 303s to the confirmation page.
 * Idempotent: reloading or replaying the URL cannot pay or cancel twice.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const number = url.searchParams.get("order") ?? "";
  const [order] = await db.select().from(orders).where(eq(orders.number, number));
  if (!order) return NextResponse.redirect(new URL("/", url), 303);

  const params = Object.fromEntries(url.searchParams.entries());
  let outcome = "pending";
  try {
    outcome = await finalizePayment(db, order, params);
  } catch (e) {
    console.error("payment verification failed", e);
  }
  const dest = new URL(`/checkout/confirm/${encodeURIComponent(order.number)}`, url);
  dest.searchParams.set("token", orderToken(order.number, order.email));
  if (outcome === "failed") dest.searchParams.set("payment", "failed");
  return NextResponse.redirect(dest, 303);
}
