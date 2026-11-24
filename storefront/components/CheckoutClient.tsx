"use client";

import Link from "next/link";
import { useState } from "react";
import { checkoutInput } from "@/shared/schemas/checkout";
import { useCart } from "../lib/cart";
import { useQuote } from "../lib/quote";
import { useStore } from "../lib/store-context";
import { CouponBox, FreeShippingBar, Totals, lineProblem } from "./cart-parts";

type Fields = {
  email: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
};

/** Single-page checkout: contact + address (Zod-validated, same schema as the server), delivery, coupon, live summary. */
export function CheckoutClient({ defaultCountry }: { defaultCountry: string }) {
  const { t, tf, money, customer, fmtNum, iso } = useStore();
  const { lines, coupon } = useCart();
  const { quote, loading, error, adjusted } = useQuote(lines, coupon);
  const [f, setF] = useState<Fields>({ email: customer?.email ?? "", fullName: customer?.name ?? "", phone: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: defaultCountry, notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [delivery] = useState<"standard">("standard");

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const byId = new Map(quote?.lines.map((l) => [l.variantId, l]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const body = {
      items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      couponCode: coupon || undefined,
      email: f.email,
      shippingAddress: { fullName: f.fullName, phone: f.phone, line1: f.line1, line2: f.line2 || undefined, city: f.city, region: f.region || undefined, postalCode: f.postalCode, country: f.country },
      deliveryMethod: delivery,
      notes: f.notes || undefined,
    };
    const parsed = checkoutInput.safeParse(body);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const key = i.path[0] === "shippingAddress" ? String(i.path[1]) : String(i.path[0]);
        errs[key] ??= i.message;
      }
      setErrors(errs);
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/storefront/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(res.status === 409 ? t.itemsChanged : data?.error ?? t.quoteError);
        return;
      }
      window.location.assign(data.redirectUrl); // gateway page (or confirmation); the cart is cleared on the paid confirmation
    } catch {
      setServerError(t.quoteError);
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-28 text-center">
        <h1 className="sf-display text-4xl">{t.bagEmpty}</h1>
        <Link href="/" className="sf-btn mt-8">{t.continueShopping}</Link>
      </div>
    );
  }

  const field = (k: keyof Fields, label: string, opts: { type?: string; auto?: string; hint?: string; className?: string; maxLength?: number; ltr?: boolean } = {}) => (
    <label className={`block ${opts.className ?? ""}`}>
      <span className="sf-label mb-1.5 block">{label}</span>
      <input className={`sf-input ${opts.ltr ? "sf-ltr" : ""}`} dir={opts.ltr ? undefined : "auto"} type={opts.type ?? "text"} autoComplete={opts.auto} maxLength={opts.maxLength} value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} placeholder={opts.hint} />
      {errors[k] && <span id={`${k}-err`} className="mt-1 block text-xs" style={{ color: "#e48a7a" }} role="alert">{errors[k]}</span>}
    </label>
  );

  const canPay = !!quote?.canCheckout && !loading && !busy;

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-6xl gap-12 px-5 py-10 md:px-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-16">
      <div className="space-y-10">
        <h1 className="sf-display text-5xl">{t.checkout}</h1>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="sf-label">{t.contact}</h2>
            {!customer && <span className="text-xs sf-muted">{t.haveAccount} <Link href="/login?next=/checkout" className="underline underline-offset-4">{t.signIn}</Link></span>}
          </div>
          {field("email", t.email, { type: "email", auto: "email", ltr: true })}
        </section>

        <section className="space-y-4">
          <h2 className="sf-label">{t.shippingAddress}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("fullName", t.fullName, { auto: "name", className: "sm:col-span-2" })}
            {field("phone", t.phone, { type: "tel", auto: "tel", className: "sm:col-span-2", ltr: true })}
            {field("line1", t.address1, { auto: "address-line1", className: "sm:col-span-2" })}
            {field("line2", t.address2, { auto: "address-line2", className: "sm:col-span-2" })}
            {field("city", t.city, { auto: "address-level2" })}
            {field("region", t.region, { auto: "address-level1" })}
            {field("postalCode", t.postalCode, { auto: "postal-code", ltr: true })}
            {field("country", t.country, { auto: "country", hint: t.countryHint, maxLength: 2, ltr: true })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="sf-label">{t.delivery}</h2>
          <div role="radiogroup" aria-label={t.delivery}>
            {(quote?.deliveryMethods ?? [{ id: "standard" as const, fee: 0 }]).map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center justify-between border px-4 py-3 sf-line" style={{ borderRadius: "var(--sf-radius)", borderColor: "var(--sf-accent)" }}>
                <span className="flex items-center gap-3 text-sm">
                  <input type="radio" name="delivery" checked readOnly className="accent-[var(--sf-accent)]" />
                  {t.standardDelivery}
                </span>
                <span className="text-sm tabular-nums">{quote && m.fee === 0 ? t.free : quote ? money(m.fee) : ""}</span>
              </label>
            ))}
          </div>
        </section>

        <label className="block">
          <span className="sf-label mb-1.5 block">{t.notes}</span>
          <textarea className="sf-input min-h-20" value={f.notes} onChange={set("notes")} maxLength={500} />
        </label>
      </div>

      {/* sticky live summary */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="sf-panel space-y-6 p-6" style={{ background: "color-mix(in srgb, var(--sf-fg) 4%, var(--sf-bg))" }}>
          <h2 className="sf-display text-3xl">{t.orderSummary}</h2>
          {quote && <FreeShippingBar quote={quote} />}
          <ul className="space-y-4">
            {lines.map((l) => {
              const q = byId.get(l.variantId);
              const problem = lineProblem(q, tf, t);
              return (
                <li key={l.variantId} className="flex gap-3 text-sm">
                  <span className="relative h-14 w-11 shrink-0 border sf-line" style={{ background: l.colorHex }}>
                    <span className="absolute -end-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] tabular-nums" style={{ background: "var(--sf-fg)", color: "var(--sf-bg)" }}>{fmtNum(l.quantity)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{l.title}</div>
                    <div className="sf-muted text-xs">{l.colorName} / {l.size}</div>
                    {problem && <div className="mt-1 text-xs" style={{ color: "#e48a7a" }}>{problem}</div>}
                  </div>
                  <div className="tabular-nums">{money((q && q.status !== "unavailable" ? q.unitPrice : l.unitPrice) * (q ? q.quantity : l.quantity))}</div>
                </li>
              );
            })}
          </ul>
          <CouponBox quote={quote} code={coupon} />
          {quote ? <Totals quote={quote} /> : <p className="sf-muted text-sm">{error ? t.quoteError : t.updatingPrices}</p>}
          {Object.keys(adjusted).length > 0 && <p className="text-xs sf-accent">{t.itemsChanged}</p>}
          {serverError && <p className="text-sm" style={{ color: "#e48a7a" }} role="alert">{serverError}</p>}
          <button className="sf-btn sf-btn-primary w-full" disabled={!canPay} type="submit">
            {busy ? t.processing : quote ? `${t.payNow} · ${iso(money(quote.total))}` : t.payNow}
          </button>
          <p className="sf-muted text-center text-xs">{t.secureNote}</p>
        </div>
      </aside>
    </form>
  );
}
