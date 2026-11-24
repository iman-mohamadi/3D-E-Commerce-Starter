"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ORDER_TRANSITIONS, type OrderStatus } from "@/shared/schemas/admin";
import { api } from "../lib/api";
import { useAdmin } from "../lib/context";
import { Empty, StatusChip } from "./ui";

interface Row {
  id: string;
  number: string;
  email: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
}
interface Detail {
  id: string;
  number: string;
  email: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode: string | null;
  trackingNumber: string | null;
  paymentProvider: string;
  paymentReference: string | null;
  createdAt: string;
  shippingAddress: { fullName: string; phone: string; line1: string; line2?: string; city: string; region?: string; postalCode: string; country: string };
  items: { id: string; title: string; sku: string; colorName: string; size: string; unitPrice: number; quantity: number; lineTotal: number }[];
}

const FLOW: OrderStatus[] = ["pending", "processing", "shipped", "delivered"];

export function OrdersTable({ rows, statuses }: { rows: Row[]; statuses: OrderStatus[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { money, notify } = useAdmin();
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const filter = params.get("status") ?? "";

  useEffect(() => {
    if (!openId) return setDetail(null);
    let live = true;
    api<{ order: Detail }>(`/api/admin/orders/${openId}`)
      .then((r) => {
        if (!live) return;
        setDetail(r.order);
        setTracking(r.order.trackingNumber ?? "");
      })
      .catch((e) => notify((e as Error).message, "error"));
    return () => {
      live = false;
    };
  }, [openId, notify]);

  async function update(body: { status?: OrderStatus; trackingNumber?: string | null }) {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await api<{ order: Detail }>(`/api/admin/orders/${detail.id}`, { method: "PATCH", body });
      setDetail(r.order);
      setTracking(r.order.trackingNumber ?? "");
      notify("Order updated");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const next = detail ? ORDER_TRANSITIONS[detail.status] : [];

  return (
    <>
      <div className="mb-4 flex gap-2">
        {["", ...statuses].map((s) => (
          <button key={s || "all"} onClick={() => router.push(s ? `/admin/orders?status=${s}` : "/admin/orders")} className={`chip cursor-pointer ${filter === s ? "border-gold text-gold" : "hover:text-bone"}`}>
            {s || "all"}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty>No orders match.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line"><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Status</th><th className="th">Total</th><th className="th">Placed</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer hover:bg-raised/40">
                  <td className="td font-mono text-xs">{o.number}</td>
                  <td className="td">{o.email}</td>
                  <td className="td">{o.itemCount}</td>
                  <td className="td"><StatusChip status={o.status} /></td>
                  <td className="td">{money(o.total)}</td>
                  <td className="td text-mute">{o.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={() => setOpenId(null)}>
          <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-line bg-panel p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Order detail">
            {!detail ? (
              <p className="text-sm text-mute">Loading...</p>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-mute">{detail.number}</div>
                    <h2 className="font-display text-3xl">{detail.email}</h2>
                    <div className="mt-2"><StatusChip status={detail.status} /></div>
                  </div>
                  <button className="btn px-3" onClick={() => setOpenId(null)} aria-label="Close">x</button>
                </div>

                <ol className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-mute">
                  {FLOW.map((s, i) => {
                    const reached = FLOW.indexOf(detail.status) >= i || (detail.status === "paid" && i === 0);
                    return <li key={s} className={`flex-1 border-t-2 pt-1 ${reached ? "border-gold text-bone" : "border-line"}`}>{s}</li>;
                  })}
                </ol>

                <section>
                  <div className="label">Items</div>
                  <ul className="divide-y divide-line rounded-sm border border-line">
                    {detail.items.map((it) => (
                      <li key={it.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                        <div>
                          <div>{it.title}</div>
                          <div className="mt-0.5 text-xs text-mute">{it.colorName} / {it.size} / <span className="font-mono">{it.sku}</span></div>
                        </div>
                        <div className="text-right"><div>{money(it.lineTotal)}</div><div className="text-xs text-mute">{it.quantity} x {money(it.unitPrice)}</div></div>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-3 space-y-1 text-sm">
                    <Row k="Subtotal" v={money(detail.subtotal)} />
                    {detail.discountTotal > 0 && <Row k={`Discount${detail.couponCode ? ` (${detail.couponCode})` : ""}`} v={`- ${money(detail.discountTotal)}`} />}
                    <Row k="Shipping" v={money(detail.shippingTotal)} />
                    <Row k="Total" v={money(detail.total)} strong />
                  </dl>
                </section>

                <section className="text-sm">
                  <div className="label">Ship to</div>
                  <address className="not-italic text-bone/90">
                    {detail.shippingAddress.fullName}<br />{detail.shippingAddress.line1}{detail.shippingAddress.line2 ? `, ${detail.shippingAddress.line2}` : ""}<br />
                    {detail.shippingAddress.city} {detail.shippingAddress.postalCode}, {detail.shippingAddress.country}<br />{detail.shippingAddress.phone}
                  </address>
                  <div className="mt-2 text-xs text-mute">Paid via {detail.paymentProvider}{detail.paymentReference ? ` (${detail.paymentReference})` : ""}</div>
                </section>

                <section className="space-y-3">
                  <div className="label">Fulfilment</div>
                  <div className="flex gap-2">
                    <input className="input" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                    <button className="btn" disabled={busy || tracking === (detail.trackingNumber ?? "")} onClick={() => update({ trackingNumber: tracking || null })}>Save</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {next.length === 0 && <span className="text-sm text-mute">No further transitions.</span>}
                    {next.map((s) => (
                      <button
                        key={s}
                        disabled={busy}
                        className={`btn capitalize ${s === "cancelled" || s === "refunded" ? "btn-danger" : "btn-primary"}`}
                        onClick={() => {
                          if ((s === "cancelled" || s === "refunded") && !confirm(`Mark this order as ${s}?`)) return;
                          void update({ status: s, ...(s === "shipped" ? { trackingNumber: tracking || null } : {}) });
                        }}
                      >
                        Mark {s}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? "border-t border-line pt-2 text-base" : "text-mute"}`}><dt>{k}</dt><dd className={strong ? "" : "text-bone"}>{v}</dd></div>;
}
