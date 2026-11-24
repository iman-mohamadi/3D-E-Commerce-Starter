"use client";

import { useState } from "react";
import type { PublicProduct, PublicVariant } from "@/shared/storefront";
import type { ViewPreset } from "@/three";
import type { Dict } from "../lib/i18n";
import { sortSizes } from "../lib/sizes";
import { useStore } from "../lib/store-context";

interface Props {
  t: Dict;
  product: PublicProduct;
  has3d: boolean;
  colorName: string;
  size: string | null;
  onColor: (name: string) => void;
  onSize: (size: string) => void;
  money: (minor: number) => string;
  view: ViewPreset;
  onView: (v: ViewPreset) => void;
  hotspotId: string | null;
  onHotspot: (id: string | null) => void;
  onSizeGuide: () => void;
  onAdd: () => void;
  added: boolean;
  onBack: () => void;
  fmtNum: (n: number) => string;
}

export interface Colorway {
  name: string;
  hex: string;
  anyInStock: boolean;
}

export function colorwaysOf(variants: PublicVariant[]): Colorway[] {
  const map = new Map<string, Colorway>();
  for (const v of variants) {
    const c = map.get(v.colorName);
    if (c) c.anyInStock ||= v.inStock;
    else map.set(v.colorName, { name: v.colorName, hex: v.colorHex, anyInStock: v.inStock });
  }
  return [...map.values()];
}

/** Editorial side panel (desktop, at the inline-end edge) / compact bottom sheet (mobile). Fully logical-property based for RTL. */
export function Inspector(p: Props) {
  const { t, product } = p;
  const { iso } = useStore();
  const colors = colorwaysOf(product.variants);
  const forColor = product.variants.filter((v) => v.colorName === p.colorName);
  const sizes = sortSizes([...new Set(forColor.map((v) => v.size))], product.sizeGuide);
  const chosen = p.size ? forColor.find((v) => v.size === p.size) : undefined;
  const price = product.basePrice + (chosen ?? forColor[0])?.priceDelta!;
  const hotspot = product.hotspots.find((h) => h.id === p.hotspotId) ?? null;
  const canAdd = !!chosen && chosen.inStock;
  const [open, setOpen] = useState(true); // mobile sheet expand/collapse

  const views: [ViewPreset, string][] = [["front", t.front], ["three-quarter", t.threeQuarter], ["back", t.back]];

  return (
    <aside
      className={`sf-panel sf-rise sf-scroll fixed inset-x-0 bottom-0 z-30 overflow-y-auto rounded-t-2xl p-5 transition-[max-height] duration-500 md:inset-y-0 md:inset-x-auto md:end-0 md:w-[400px] md:max-h-none md:rounded-none md:border-y-0 md:border-e-0 md:p-8 md:pt-24 ${open ? "max-h-[48vh]" : "max-h-[96px]"}`}
      aria-label={product.title}
    >
      <button className="mx-auto mb-3 block h-1 w-10 rounded-full md:hidden" style={{ background: "color-mix(in srgb, var(--sf-fg) 35%, transparent)" }} onClick={() => setOpen((o) => !o)} aria-label="Toggle panel" />

      <div className="mb-5 flex items-center justify-between">
        <button className="sf-label inline-flex items-center gap-2 hover:opacity-70" onClick={p.onBack}>
          <span aria-hidden className="rtl:rotate-180">&larr;</span> {t.backToRack} <kbd className="hidden rounded border px-1 sf-line md:inline">{t.skipEsc}</kbd>
        </button>
      </div>

      <h2 className="sf-display text-4xl leading-none md:text-5xl">{product.title}</h2>
      <div className="mt-3 text-lg tabular-nums">{p.money(price)}</div>
      {product.description && <p className="sf-muted mt-4 text-sm leading-relaxed">{product.description}</p>}

      {/* colorways */}
      <section className="mt-7">
        <div className="mb-3 flex items-baseline justify-between"><span className="sf-label">{t.colorway}</span><span className="text-sm">{p.colorName}</span></div>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t.colorway}>
          {colors.map((c) => (
            <button key={c.name} role="radio" aria-checked={c.name === p.colorName} aria-label={c.name} title={c.name} className="sf-swatch" style={{ background: c.hex, opacity: c.anyInStock ? 1 : 0.4 }} onClick={() => p.onColor(c.name)} />
          ))}
        </div>
      </section>

      {/* sizes */}
      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="sf-label">{t.size}</span>
          {product.sizeGuide && <button className="sf-label underline underline-offset-4 hover:opacity-70" onClick={p.onSizeGuide}>{t.sizeGuide}</button>}
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.size}>
          {sizes.map((s) => {
            const v = forColor.find((x) => x.size === s);
            const out = !v?.inStock;
            return (
              <button key={s} role="radio" aria-checked={p.size === s} disabled={out} title={out ? t.outOfStock : undefined} className="sf-size" onClick={() => p.onSize(s)}>
                {s}
              </button>
            );
          })}
        </div>
      </section>

      {/* camera + hotspots */}
      {p.has3d && (
        <section className="mt-7">
          <div className="sf-label mb-3">{t.views}</div>
          <div className="flex gap-2">
            {views.map(([v, label]) => (
              <button key={v} className="sf-chip" aria-pressed={p.view === v && !p.hotspotId} onClick={() => { p.onHotspot(null); p.onView(v); }}>{label}</button>
            ))}
          </div>

          {product.hotspots.length > 0 && (
            <div className="mt-6">
              <div className="sf-label mb-3">{t.details}</div>
              <div className="flex flex-wrap gap-2">
                {product.hotspots.map((h, i) => (
                  <button key={h.id} className="sf-chip" aria-pressed={p.hotspotId === h.id} onClick={() => p.onHotspot(p.hotspotId === h.id ? null : h.id)}>
                    <span className="tabular-nums">{p.fmtNum(i + 1)}</span> {h.label}
                  </button>
                ))}
              </div>
              {hotspot && (
                <div key={hotspot.id} className="sf-rise mt-4 border-s-2 ps-4" style={{ borderColor: "var(--sf-accent)" }}>
                  <div className="sf-display text-xl">{hotspot.label}</div>
                  {hotspot.description && <p className="sf-muted mt-1 text-sm leading-relaxed">{hotspot.description}</p>}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="sticky bottom-0 -mx-5 mt-8 px-5 pb-1 pt-4 md:-mx-8 md:px-8" style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--sf-bg) 96%, transparent) 60%, transparent)" }}>
        <button className={`sf-btn w-full ${canAdd ? "sf-btn-primary" : ""}`} disabled={!canAdd} onClick={p.onAdd} aria-live="polite">
          {p.added ? `${t.added}  ✓` : chosen && !chosen.inStock ? t.outOfStock : canAdd ? `${t.addToBag} · ${iso(p.money(price))}` : t.selectSize}
        </button>
      </div>
    </aside>
  );
}

export function SizeGuideModal({ t, product, onClose }: { t: Dict; product: PublicProduct; onClose: () => void }) {
  const g = product.sizeGuide;
  if (!g) return null;
  const label = (c: string) => g.labels?.[c] ?? c.replace(/_/g, " ");
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="sf-panel sf-rise w-full max-w-lg p-6 md:p-8" style={{ background: "var(--sf-bg)" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t.sizeGuide}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="sf-label">{t.sizeGuide}</div>
            <h3 className="sf-display text-3xl">{product.title}</h3>
          </div>
          <button className="sf-label hover:opacity-70" onClick={onClose} autoFocus>{t.close}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b sf-line">
                <th className="sf-label py-2 pe-4 text-start font-normal">{t.size}</th>
                {g.columns.map((c) => <th key={c} className="sf-label py-2 pe-4 text-start font-normal capitalize">{label(c)} <span className="opacity-60">({g.unit})</span></th>)}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.size} className="border-b sf-line">
                  <td className="py-3 pe-4 font-medium">{r.size}</td>
                  {g.columns.map((c) => <td key={c} className="py-3 pe-4 tabular-nums">{r.measurements[c] ?? "-"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {g.note && <p className="sf-muted mt-4 text-xs leading-relaxed">{g.note}</p>}
      </div>
    </div>
  );
}
