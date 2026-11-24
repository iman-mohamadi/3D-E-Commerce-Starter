"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cart, useCart } from "../lib/cart";
import { useQuote } from "../lib/quote";
import { useStore } from "../lib/store-context";
import { CouponBox, FreeShippingBar, Totals, lineProblem } from "./cart-parts";

/** Bag button with live badge + the slide-over cart drawer it opens. */
export function BagControl() {
  const { t, rtl } = useStore();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) setBump((b) => b + 1);
    prev.current = count;
  }, [count]);

  return (
    <>
      <button className="sf-btn relative" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${t.bag} (${count})`}>
        {t.bag}
        <span key={bump} className={`inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] tabular-nums ${bump ? "sf-bump" : ""}`} style={{ background: count ? "var(--sf-accent)" : "transparent", color: count ? "var(--sf-bg)" : "inherit", border: count ? "none" : "1px solid currentColor" }}>
          {count}
        </span>
      </button>
      {open && <CartDrawer rtl={rtl} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Slide-over cart: live server pricing, stock-aware quantity controls, coupon, free-shipping progress. */
export function CartDrawer({ rtl, onClose }: { rtl: boolean; onClose: () => void }) {
  const { t, tf, money, fmtNum } = useStore();
  const { lines, coupon } = useCart();
  const { quote, loading, error, adjusted } = useQuote(lines, coupon);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const byId = new Map(quote?.lines.map((l) => [l.variantId, l]));
  const blocked = quote ? quote.lines.filter((l) => l.status === "out_of_stock" || l.status === "unavailable") : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        className="sf-panel sf-slide absolute inset-y-0 end-0 flex w-full max-w-md flex-col"
        style={{ ["--d" as string]: rtl ? -1 : 1, background: "color-mix(in srgb, var(--sf-bg) 94%, transparent)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.yourBag}
      >
        <header className="flex items-center justify-between border-b px-6 py-5 sf-line">
          <h2 className="sf-display text-3xl">{t.yourBag}</h2>
          <button ref={closeRef} className="sf-label hover:opacity-70" onClick={onClose}>{t.close}</button>
        </header>

        {lines.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <p className="sf-muted">{t.bagEmpty}</p>
              <button className="sf-btn mt-6" onClick={onClose}>{t.continueShopping}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="sf-scroll flex-1 overflow-y-auto px-6 py-5">
              {quote && <div className="mb-6"><FreeShippingBar quote={quote} /></div>}
              <ul className="space-y-5">
                {lines.map((l) => {
                  const q = byId.get(l.variantId);
                  const problem = lineProblem(q, tf, t);
                  const unit = q && q.status !== "unavailable" ? q.unitPrice : l.unitPrice;
                  const max = q ? q.maxQuantity : 10;
                  const dead = q?.status === "out_of_stock" || q?.status === "unavailable";
                  return (
                    <li key={l.variantId} className="flex gap-4" style={{ opacity: dead ? 0.55 : 1 }}>
                      <div className="h-20 w-16 shrink-0 overflow-hidden border sf-line" style={{ background: l.colorHex }}>
                        {(q?.image ?? l.image) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={(q?.image ?? l.image)!} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="sf-display truncate text-xl leading-tight">{l.title}</div>
                            <div className="sf-muted mt-0.5 text-xs">{l.colorName} / {l.size}</div>
                          </div>
                          <div className="text-sm tabular-nums">{money(unit * (q ? q.quantity : l.quantity))}</div>
                        </div>
                        {problem && <p className="mt-1.5 text-xs" style={{ color: dead ? "#e48a7a" : "var(--sf-accent)" }} role="status">{problem}</p>}
                        <div className="mt-3 flex items-center gap-3 text-sm">
                          <div className="flex items-center border sf-line" style={{ borderRadius: "var(--sf-radius)" }}>
                            <button className="px-3 py-1 hover:opacity-60 disabled:opacity-30" onClick={() => cart.setQuantity(l.variantId, l.quantity - 1)} aria-label="-" disabled={dead}>-</button>
                            <span className="min-w-6 text-center tabular-nums" aria-live="polite">{fmtNum(l.quantity)}</span>
                            <button className="px-3 py-1 hover:opacity-60 disabled:opacity-30" onClick={() => cart.setQuantity(l.variantId, Math.min(max, l.quantity + 1))} aria-label="+" disabled={dead || l.quantity >= max}>+</button>
                          </div>
                          <button className="sf-muted text-xs underline underline-offset-4 hover:opacity-70" onClick={() => cart.remove(l.variantId)}>{t.remove}</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {Object.keys(adjusted).length > 0 && <p className="sf-muted mt-5 text-xs">{t.itemsChanged}</p>}
            </div>

            <footer className="space-y-4 border-t px-6 py-5 sf-line">
              <CouponBox quote={quote} code={coupon} />
              {quote ? <Totals quote={quote} /> : <p className="sf-muted text-sm">{error ? t.quoteError : t.updatingPrices}</p>}
              {error && quote && <p className="text-xs" style={{ color: "#e48a7a" }}>{t.quoteError}</p>}
              {blocked.length > 0 && (
                <button className="sf-label underline underline-offset-4" onClick={() => cart.removeMany(blocked.map((b) => b.variantId))}>{t.removeUnavailable}</button>
              )}
              {quote?.canCheckout && !loading ? (
                <Link href="/checkout" className="sf-btn sf-btn-primary w-full" onClick={onClose}>{t.proceedToCheckout}</Link>
              ) : (
                <button className="sf-btn sf-btn-primary w-full" disabled>{loading ? t.updatingPrices : t.proceedToCheckout}</button>
              )}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
