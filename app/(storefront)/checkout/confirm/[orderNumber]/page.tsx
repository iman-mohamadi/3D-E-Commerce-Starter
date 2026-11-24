import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { currentUser } from "@/server/auth/guards";
import { verifyOrderToken } from "@/server/services/order-access";
import { toReceipt } from "@/server/services/receipts";
import { SiteHeader } from "@/storefront/components/Hud";
import { ConfirmView, OrderLookup } from "@/storefront/components/ConfirmClient";

export const metadata: Metadata = { title: "Order", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Order confirmation. Visible to the signed-in owner, or to anyone holding the guest token
 * (HMAC of order number + email); everyone else gets the lookup form, which never reveals whether an order exists.
 */
export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ token?: string; payment?: string }> }) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const number = decodeURIComponent(orderNumber).toUpperCase();
  const order = await db.query.orders.findFirst({ where: eq(orders.number, number), with: { items: true } });
  const user = await currentUser();
  const allowed = !!order && ((!!user && user.id === order.userId) || verifyOrderToken(order.number, order.email, sp.token));

  return (
    <>
      <SiteHeader />
      {allowed && order ? <ConfirmView order={toReceipt(order)} paymentFailed={sp.payment === "failed"} /> : <OrderLookup orderNumber={number} />}
    </>
  );
}
