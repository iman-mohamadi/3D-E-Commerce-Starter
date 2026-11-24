import Link from "next/link";
import { PageHeader, StatusChip } from "@/admin/components/ui";
import { Money } from "@/admin/components/Money";
import { LOW_STOCK_THRESHOLD, getDashboard } from "@/server/services/admin";

export default async function Overview() {
  const d = await getDashboard();
  const kpis = [
    { label: "Total revenue", value: <Money minor={d.revenue} />, note: "paid, processing, shipped, delivered" },
    { label: "Open orders", value: d.pendingOrders, note: "pending, paid or processing" },
    { label: "Low-stock variants", value: d.lowStock, note: `${LOW_STOCK_THRESHOLD} units or fewer, active products` },
    { label: "3D assets", value: d.glbAssets + d.proceduralAssets, note: `${d.glbAssets} GLB models, ${d.proceduralAssets} procedural` },
  ];
  return (
    <>
      <PageHeader title="Overview" subtitle="The state of the atelier at a glance." />
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="label">{k.label}</div>
            <div className="mt-2 font-display text-4xl">{k.value}</div>
            <div className="mt-1 text-xs text-mute">{k.note}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm text-gold hover:underline">View all</Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Status</th><th className="th">Total</th><th className="th">Placed</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.recent.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-mute">No orders yet.</td></tr>}
              {d.recent.map((o) => (
                <tr key={o.id} className="hover:bg-raised/40">
                  <td className="td font-mono text-xs"><Link href={`/admin/orders?open=${o.id}`} className="hover:text-gold">{o.number}</Link></td>
                  <td className="td">{o.email}</td>
                  <td className="td"><StatusChip status={o.status} /></td>
                  <td className="td"><Money minor={o.total} /></td>
                  <td className="td text-mute">{o.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
