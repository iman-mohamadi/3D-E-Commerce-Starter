"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cart } from "../lib/cart";
import { useStore } from "../lib/store-context";
import { OrderReceipt, type ReceiptOrder } from "./OrderReceipt";

/** Clears the bag once the order is confirmed paid (not while pending or after a failed payment). */
export function ClearCartOnPaid({ paid }: { paid: boolean }) {
  useEffect(() => {
    if (paid) cart.clear();
  }, [paid]);
  return null;
}

export function ConfirmView({ order, paymentFailed }: { order: ReceiptOrder; paymentFailed: boolean }) {
  const { t, customer } = useStore();
  const paidish = ["paid", "processing", "shipped", "delivered"].includes(order.status);
  const failed = paymentFailed || order.status === "cancelled";
  return (
    <div className="mx-auto max-w-2xl px-5 py-14 md:py-20">
      <ClearCartOnPaid paid={paidish} />
      <p className="sf-label sf-accent">{failed ? t.s_cancelled : paidish ? t.orderReceived : t.s_pending}</p>
      <h1 className="sf-display mt-3 text-5xl leading-[1.05]">{failed ? t.paymentFailed : paidish ? t.orderConfirmed : t.paymentPending}</h1>
      <div className="mt-10">
        <OrderReceipt order={order} />
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        {failed ? <Link href="/checkout" className="sf-btn sf-btn-primary">{t.tryAgain}</Link> : <Link href="/" className="sf-btn sf-btn-primary">{t.backToStore}</Link>}
        {customer && <Link href="/account/orders" className="sf-btn">{t.viewOrders}</Link>}
      </div>
    </div>
  );
}

/** Guest lookup: order number + email -> access token (no account needed, no email in the URL). */
export function OrderLookup({ orderNumber }: { orderNumber: string }) {
  const { t } = useStore();
  const router = useRouter();
  const [number, setNumber] = useState(orderNumber);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/storefront/orders/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: number, email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(t.notFound);
      router.replace(`/checkout/confirm/${encodeURIComponent(number.trim().toUpperCase())}?token=${data.token}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-5 px-5 py-20">
      <h1 className="sf-display text-4xl">{t.lookupTitle}</h1>
      <p className="sf-muted text-sm">{t.lookupHint}</p>
      <label className="block"><span className="sf-label mb-1.5 block">{t.orderNumber}</span><input className="sf-input sf-ltr font-mono uppercase" value={number} onChange={(e) => setNumber(e.target.value)} required /></label>
      <label className="block"><span className="sf-label mb-1.5 block">{t.email}</span><input className="sf-input sf-ltr" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      {error && <p className="text-sm" style={{ color: "#e48a7a" }} role="alert">{error}</p>}
      <button className="sf-btn sf-btn-primary w-full" disabled={busy}>{busy ? t.processing : t.find}</button>
    </form>
  );
}
