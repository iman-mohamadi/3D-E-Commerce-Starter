"use client";

import Link from "next/link";
import { useStore } from "../lib/store-context";
import { SignOutButton } from "./AuthForm";
import { OrderReceipt, StatusPill, type ReceiptOrder } from "./OrderReceipt";

/** Customer order history with fulfilment status, tracking number and an itemised receipt per order. */
export function OrdersList({ orders, name }: { orders: ReceiptOrder[]; name: string }) {
  const { t, money, intl } = useStore();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="sf-label">{name}</p>
          <h1 className="sf-display text-5xl">{t.myOrders}</h1>
        </div>
        <SignOutButton />
      </div>

      {orders.length === 0 ? (
        <div className="border px-6 py-16 text-center sf-line" style={{ borderRadius: "var(--sf-radius)" }}>
          <p className="sf-muted">{t.noOrders}</p>
          <Link href="/" className="sf-btn mt-6">{t.continueShopping}</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.number} className="border sf-line" style={{ borderRadius: "var(--sf-radius)" }}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="font-mono text-sm">{o.number}</div>
                    <div className="sf-muted mt-0.5 text-xs">{new Date(o.createdAt).toLocaleDateString(intl, { dateStyle: "medium" })}</div>
                  </div>
                  <div className="flex items-center gap-5">
                    {o.trackingNumber && (o.status === "shipped" || o.status === "delivered") && (
                      <span className="hidden text-xs sm:inline"><span className="sf-label me-2">{t.trackingNumber}</span><span className="font-mono">{o.trackingNumber}</span></span>
                    )}
                    <StatusPill status={o.status} />
                    <span className="tabular-nums">{money(o.total)}</span>
                  </div>
                </summary>
                <div className="border-t px-5 py-6 sf-line">
                  <OrderReceipt order={o} compact />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
