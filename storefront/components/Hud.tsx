"use client";

import { useEffect, useRef, useState } from "react";
import { cart, useCart, type CartLine } from "../lib/cart";
import type { Dict } from "../lib/i18n";

interface HudProps {
  t: Dict;
  brand: string;
  logoUrl: string | null;
  racks: { slug: string; title: string }[];
  activeRack: string;
  onRack: (slug: string) => void;
  money: (minor: number) => string;
  fmtNum: (n: number) => string;
  dimmed: boolean;
}

export function TopHud({ t, brand, logoUrl, racks, activeRack, onRack, money, dimmed }: HudProps) {
  const { count, lines, subtotal } = useCart();
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) setBump((b) => b + 1);
    prev.current = count;
  }, [count]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <div className="pointer-events-auto flex items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-6">
        <a href="/" className="flex items-center gap-3" aria-label={brand}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} className="h-7 w-auto" />
          ) : (
            <span className="sf-display text-2xl leading-none md:text-3xl">{brand}</span>
          )}
        </a>

        {racks.length > 1 && (
          <nav className="hidden items-center gap-2 md:flex" role="tablist" aria-label={t.racks} style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity .4s" }}>
            {racks.map((r) => (
              <button key={r.slug} role="tab" aria-selected={r.slug === activeRack} className="sf-chip" onClick={() => onRack(r.slug)} disabled={dimmed}>
                {r.title}
              </button>
            ))}
          </nav>
        )}

        <button className="sf-btn relative" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${t.bag} (${count})`}>
          {t.bag}
          <span key={bump} className={`inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] tabular-nums ${bump ? "sf-bump" : ""}`} style={{ background: count ? "var(--sf-accent)" : "transparent", color: count ? "var(--sf-bg)" : "inherit", border: count ? "none" : "1px solid currentColor" }}>
            {count}
          </span>
        </button>
      </div>

      {racks.length > 1 && (
        <nav className={`sf-scroll flex gap-2 overflow-x-auto px-5 pb-2 transition-opacity duration-300 md:hidden ${dimmed ? "pointer-events-none" : "pointer-events-auto"}`} role="tablist" aria-label={t.racks} style={{ opacity: dimmed ? 0 : 1 }}>
          {racks.map((r) => (
            <button key={r.slug} role="tab" aria-selected={r.slug === activeRack} className="sf-chip" onClick={() => onRack(r.slug)} disabled={dimmed}>
              {r.title}
            </button>
          ))}
        </nav>
      )}

      {open && (
        <div className="pointer-events-auto sf-panel sf-rise absolute end-4 top-16 w-[min(22rem,calc(100vw-2rem))] p-5 md:end-8 md:top-20" role="dialog" aria-label={t.yourBag}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="sf-display text-2xl">{t.yourBag}</h2>
            <button className="sf-label hover:opacity-70" onClick={() => setOpen(false)}>{t.close}</button>
          </div>
          {lines.length === 0 ? (
            <p className="sf-muted py-6 text-sm">{t.bagEmpty}</p>
          ) : (
            <>
              <ul className="sf-scroll max-h-[40vh] space-y-4 overflow-y-auto pe-1">
                {lines.map((l) => <BagLine key={l.variantId} l={l} money={money} t={t} />)}
              </ul>
              <div className="mt-5 flex items-baseline justify-between border-t pt-4 sf-line">
                <span className="sf-label">{t.subtotal}</span>
                <span className="text-lg">{money(subtotal)}</span>
              </div>
              <button className="sf-btn mt-4 w-full" disabled>{t.checkoutSoon}</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function BagLine({ l, money, t }: { l: CartLine; money: (n: number) => string; t: Dict }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 h-9 w-9 shrink-0 rounded-sm border sf-line" style={{ background: l.colorHex }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate">{l.title}</div>
        <div className="sf-muted text-xs">{l.colorName} / {l.size}</div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <button className="sf-chip !px-2 !py-0.5" onClick={() => cart.setQuantity(l.variantId, l.quantity - 1)} aria-label="-">-</button>
          <span className="tabular-nums">{l.quantity}</span>
          <button className="sf-chip !px-2 !py-0.5" onClick={() => cart.setQuantity(l.variantId, l.quantity + 1)} aria-label="+">+</button>
          <button className="sf-muted ms-2 underline-offset-4 hover:underline" onClick={() => cart.remove(l.variantId)}>{t.remove}</button>
        </div>
      </div>
      <div className="tabular-nums">{money(l.unitPrice * l.quantity)}</div>
    </li>
  );
}

interface BottomProps {
  t: Dict;
  visible: boolean;
  index: number;
  total: number;
  title: string;
  fmtNum: (n: number) => string;
  onPrev: () => void;
  onNext: () => void;
  rtl: boolean;
}

/** Bottom navigation: hint, prev/next, counter. Arrows are *visual* (left/right) in both directions. */
export function BottomHud({ t, visible, index, total, title, fmtNum, onPrev, onNext, rtl }: BottomProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-6 transition-opacity duration-500 md:pb-8"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto flex items-center gap-5">
        <button className="sf-btn !rounded-full !px-3" onClick={onPrev} aria-label={rtl ? t.next : t.previous} tabIndex={visible ? 0 : -1}>
          <span aria-hidden>&larr;</span>
        </button>
        <div className="min-w-36 text-center">
          <div className="sf-display text-xl leading-tight">{title}</div>
          <div className="sf-label mt-1 tabular-nums">{fmtNum(index + 1)} / {fmtNum(total)}</div>
        </div>
        <button className="sf-btn !rounded-full !px-3" onClick={onNext} aria-label={rtl ? t.previous : t.next} tabIndex={visible ? 0 : -1}>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
      <div className="sf-label hidden md:block">{t.hint}</div>
    </div>
  );
}
