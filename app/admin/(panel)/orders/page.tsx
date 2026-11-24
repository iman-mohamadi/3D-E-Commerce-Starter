import { Suspense } from "react";
import { PageHeader } from "@/admin/components/ui";
import { OrdersTable } from "@/admin/components/OrdersTable";
import { orderStatusValues } from "@/shared/schemas/admin";
import { listOrders } from "@/server/services/admin";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = (orderStatusValues as readonly string[]).includes(status ?? "") ? status : undefined;
  const rows = await listOrders({ status: valid });
  return (
    <>
      <PageHeader title="Orders" subtitle="Click an order to inspect variants and move it through fulfilment." />
      <Suspense>
        <OrdersTable
          statuses={[...orderStatusValues]}
          rows={rows.map((o) => ({ id: o.id, number: o.number, email: o.email, status: o.status, total: o.total, itemCount: o.itemCount, createdAt: o.createdAt.toISOString() }))}
        />
      </Suspense>
    </>
  );
}
