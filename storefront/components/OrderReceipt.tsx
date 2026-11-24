"use client";

import { useStore } from "../lib/store-context";
import type { Dict } from "../lib/i18n";

export interface ReceiptOrder {
  number: string;
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  createdAt: string;
  email: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode: string | null;
  trackingNumber: string | null;
  shippingAddress: { fullName: string; phone: string; line1: string; line2?: string; city: string; region?: string; postalCode: string; country: string };
  items: { id: string; title: string; sku: string; colorName: string; size: string; unitPrice: number; quantity: number; lineTotal: number }[];
}

const TONE: Record<ReceiptOrder["status"], string> = {
  pending: "#d9b45a",
  paid: "#7fc8a0",
  processing: "#8fb2e8",
  shipped: "#b79ae8",
  delivered: "#7fc8a0",
  cancelled: "#e48a7a",
  refunded: "#9a9aa3",
};

export function StatusPill({ status }: { status: ReceiptOrder["status"] }) {
  const { t } = useStore();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em]" style={{ borderColor: TONE[status], color: TONE[status] }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[status] }} />
      {t[`s_${status}` as keyof Dict]}
    </span>
  );
}

/** Itemised order: variant colour/size/SKU snapshot, totals, tracking number (when shipped), shipping address. */
export function OrderReceipt({ order, compact }: { order: ReceiptOrder; compact?: boolean }) {
  const { t, money, fmtNum, intl, iso } = useStore();
  const a = order.shippingAddress;
  const showTracking = !!order.trackingNumber && (order.status === "shipped" || order.status === "delivered");
  return (
    <div className="space-y-6">
      {!compact && (
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="sf-label">{t.orderNumber}</dt><dd className="mt-1 font-mono">{order.number}</dd></div>
          <div><dt className="sf-label">{t.status}</dt><dd className="mt-1"><StatusPill status={order.status} /></dd></div>
          {showTracking && <div><dt className="sf-label">{t.trackingNumber}</dt><dd className="mt-1 font-mono">{order.trackingNumber}</dd></div>}
        </dl>
      )}
      {compact && showTracking && <p className="text-sm"><span className="sf-label me-2">{t.trackingNumber}</span><span className="font-mono">{order.trackingNumber}</span></p>}

      <section>
        <h3 className="sf-label mb-3">{t.items}</h3>
        <ul className="divide-y sf-line">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <div>{it.title}</div>
                <div className="sf-muted mt-0.5 text-xs">{it.colorName} / {it.size} / <span className="font-mono">{it.sku}</span></div>
              </div>
              <div className="text-end tabular-nums">
                <div>{money(it.lineTotal)}</div>
                <div className="sf-muted text-xs">{iso(`${fmtNum(it.quantity)} × ${money(it.unitPrice)}`)}</div>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="sf-muted">{t.subtotal}</dt><dd className="tabular-nums">{money(order.subtotal)}</dd></div>
          {order.discountTotal > 0 && <div className="flex justify-between sf-accent"><dt>{t.discount}{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd className="tabular-nums">{iso(`- ${money(order.discountTotal)}`)}</dd></div>}
          <div className="flex justify-between"><dt className="sf-muted">{t.shipping}</dt><dd className="tabular-nums">{order.shippingTotal === 0 ? t.free : money(order.shippingTotal)}</dd></div>
          <div className="flex items-baseline justify-between border-t pt-3 sf-line"><dt className="sf-label">{t.total}</dt><dd className="sf-display text-2xl tabular-nums">{money(order.total)}</dd></div>
        </dl>
      </section>

      <section className="text-sm">
        <h3 className="sf-label mb-2">{t.shipTo}</h3>
        <address className="not-italic leading-relaxed">
          {a.fullName}<br />
          {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
          {a.city}{a.region ? `, ${a.region}` : ""} {a.postalCode}, {a.country}<br />
          <span className="sf-muted">{a.phone} / {order.email}</span>
        </address>
        <p className="sf-muted mt-3 text-xs">{t.placedOn} {new Date(order.createdAt).toLocaleDateString(intl, { dateStyle: "long" })}</p>
      </section>
    </div>
  );
}
