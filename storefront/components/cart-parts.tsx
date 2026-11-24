"use client";

import { useState } from "react";
import type { QuoteLine, QuoteResponse } from "@/shared/schemas/checkout";
import { cart } from "../lib/cart";
import { useStore } from "../lib/store-context";

/** Coupon input with inline validation feedback straight from the server quote. */
export function CouponBox({ quote, code }: { quote: QuoteResponse | null; code: string }) {
  const { t, tf, money } = useStore();
  const [text, setText] = useState("");
  const c = quote?.coupon ?? null;
  const applyCode = () => {
    if (text.trim()) cart.setCoupon(text);
    setText("");
  };

  if (code && c?.applied) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="sf-accent">
          {t.couponApplied}: <span className="font-medium tracking-wider">{c.code}</span>
        </span>
        <button className="sf-label underline underline-offset-4 hover:opacity-70" onClick={() => cart.setCoupon("")}>{t.removeCoupon}</button>
      </div>
    );
  }
  const problem = c && !c.applied && c.reason ? (c.reason === "min_subtotal" ? tf("coupon_min_subtotal", { amount: money(c.minSubtotal ?? 0) }) : t[`coupon_${c.reason}` as const]) : null;
  return (
    <div>
      <div className="flex gap-2">
        <input
          className="sf-ltr min-w-0 flex-1 border bg-transparent px-3 py-2 text-sm uppercase tracking-wider outline-none sf-line placeholder:normal-case placeholder:tracking-normal"
          style={{ borderRadius: "var(--sf-radius)", color: "var(--sf-fg)" }}
          placeholder={t.couponPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t.couponPlaceholder}
          maxLength={40}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // this box can live inside the checkout <form>
              applyCode();
            }
          }}
        />
        <button className="sf-btn !px-4" type="button" onClick={applyCode}>{t.apply}</button>
      </div>
      {code && problem && (
        <p className="mt-2 text-xs" style={{ color: "#e48a7a" }} role="alert">
          <span className="font-medium">{code}</span>: {problem}{" "}
          <button className="underline underline-offset-4" onClick={() => cart.setCoupon("")}>{t.removeCoupon}</button>
        </p>
      )}
    </div>
  );
}

export function FreeShippingBar({ quote }: { quote: QuoteResponse }) {
  const { t, tf, money } = useStore();
  const s = quote.shipping;
  if (s.freeThreshold === null || quote.lines.length === 0) return null;
  const pct = Math.min(100, Math.round(((s.freeThreshold - (s.remainingForFree ?? 0)) / s.freeThreshold) * 100));
  return (
    <div>
      <p className="mb-2 text-xs">{s.isFree ? <span className="sf-accent">{t.freeShippingUnlocked}</span> : tf("freeShippingMore", { amount: money(s.remainingForFree ?? 0) })}</p>
      <div className="h-px w-full" style={{ background: "color-mix(in srgb, var(--sf-fg) 20%, transparent)" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-[3px] -translate-y-px origin-left transition-[width] duration-700" style={{ width: `${pct}%`, background: "var(--sf-accent)" }} />
      </div>
    </div>
  );
}

export function Totals({ quote }: { quote: QuoteResponse }) {
  const { t, money, iso } = useStore();
  const row = "flex items-baseline justify-between text-sm";
  return (
    <dl className="space-y-2">
      <div className={row}><dt className="sf-muted">{t.subtotal}</dt><dd className="tabular-nums">{money(quote.subtotal)}</dd></div>
      {quote.discountTotal > 0 && <div className={row}><dt className="sf-accent">{t.discount}{quote.coupon?.applied ? ` (${quote.coupon.code})` : ""}</dt><dd className="sf-accent tabular-nums">{iso(`- ${money(quote.discountTotal)}`)}</dd></div>}
      <div className={row}><dt className="sf-muted">{t.shipping}</dt><dd className="tabular-nums">{quote.shipping.fee === 0 && quote.lines.length ? t.free : money(quote.shipping.fee)}</dd></div>
      <div className="flex items-baseline justify-between border-t pt-3 sf-line"><dt className="sf-label">{t.total}</dt><dd className="sf-display text-2xl tabular-nums">{money(quote.total)}</dd></div>
    </dl>
  );
}

export function lineProblem(l: QuoteLine | undefined, tf: ReturnType<typeof useStore>["tf"], t: ReturnType<typeof useStore>["t"]): string | null {
  if (!l) return null;
  if (l.status === "out_of_stock") return t.lineOutOfStock;
  if (l.status === "unavailable") return t.lineUnavailable;
  if (l.status === "reduced") return tf("qtyReduced", { n: l.quantity });
  return null;
}
