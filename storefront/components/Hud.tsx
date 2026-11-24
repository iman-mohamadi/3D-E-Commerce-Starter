"use client";

import Link from "next/link";
import type { Dict } from "../lib/i18n";
import { useStore } from "../lib/store-context";
import { BagControl } from "./CartDrawer";

export function AccountLink() {
  const { t, customer } = useStore();
  return (
    <Link href={customer ? "/account/orders" : "/login"} className="sf-label hidden hover:opacity-70 sm:inline">
      {customer ? t.account : t.signIn}
    </Link>
  );
}

export function Brand() {
  const { brand, logoUrl } = useStore();
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={brand}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={brand} className="h-7 w-auto" />
      ) : (
        <span className="sf-display text-2xl leading-none md:text-3xl">{brand}</span>
      )}
    </Link>
  );
}

interface TopProps {
  racks: { slug: string; title: string }[];
  activeRack: string;
  onRack: (slug: string) => void;
  dimmed: boolean;
}

/** Top HUD of the 3D rack: brand, rack switcher, account link, bag + cart drawer. */
export function TopHud({ racks, activeRack, onRack, dimmed }: TopProps) {
  const { t } = useStore();
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <div className="pointer-events-auto flex items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-6">
        <Brand />

        {racks.length > 1 && (
          <nav className="hidden items-center gap-2 md:flex" role="tablist" aria-label={t.racks} style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity .4s" }}>
            {racks.map((r) => (
              <button key={r.slug} role="tab" aria-selected={r.slug === activeRack} className="sf-chip" onClick={() => onRack(r.slug)} disabled={dimmed}>
                {r.title}
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-4">
          <AccountLink />
          <BagControl />
        </div>
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
    </header>
  );
}

/** Slim header for non-3D pages (checkout, account, confirmation). */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-5 py-4 sf-line md:px-10 md:py-5">
      <Brand />
      <div className="flex items-center gap-4">
        <AccountLink />
        <BagControl />
      </div>
    </header>
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

/** Bottom navigation: hint, prev/next, counter. Arrows are visual (left/right) in both directions. */
export function BottomHud({ t, visible, index, total, title, fmtNum, onPrev, onNext, rtl }: BottomProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-6 transition-opacity duration-500 md:pb-8"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      {/* physical left/right arrows in both directions: the left button always moves the rack left (ltr here, text restored below) */}
      <div className="pointer-events-auto flex items-center gap-5" dir="ltr">
        <button className="sf-btn !rounded-full !px-3" onClick={onPrev} aria-label={rtl ? t.next : t.previous} tabIndex={visible ? 0 : -1}>
          <span aria-hidden>&larr;</span>
        </button>
        <div className="min-w-36 text-center" dir={rtl ? "rtl" : "ltr"}>
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
