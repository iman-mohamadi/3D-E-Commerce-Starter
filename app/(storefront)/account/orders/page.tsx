import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { currentUser } from "@/server/auth/guards";
import { toReceipt } from "@/server/services/receipts";
import { OrdersList } from "@/storefront/components/OrdersList";
import { SiteHeader } from "@/storefront/components/Hud";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Customer order history. proxy.ts is the coarse gate; the user row is re-read here like requireUser() does. */
export default async function AccountOrders() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/orders");
  const rows = await db.query.orders.findMany({ where: eq(orders.userId, user.id), with: { items: true }, orderBy: [desc(orders.createdAt)] });
  return (
    <>
      <SiteHeader />
      <OrdersList orders={rows.map(toReceipt)} name={user.name ?? user.email} />
    </>
  );
}
