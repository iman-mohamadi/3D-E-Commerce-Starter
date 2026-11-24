"use client";

import type { PublicProduct } from "@/shared/storefront";
import type { Dict } from "../lib/i18n";

/** WebGL-unavailable fallback: clean editorial cards using fallback_image_url (or a colour block from the first variant). */
export function FallbackGrid({ t, products, money, onOpen }: { t: Dict; products: PublicProduct[]; money: (n: number) => string; onOpen: (id: string) => void }) {
  if (products.length === 0) return <p className="sf-muted px-6 pt-32 text-center">{t.noProducts}</p>;
  return (
    <section className="sf-scroll absolute inset-0 overflow-y-auto px-5 pb-16 pt-32 md:px-10">
      <p className="sf-muted mb-8 max-w-md text-sm">{t.noWebgl}</p>
      <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {products.map((p, i) => (
          <li key={p.id} className="sf-rise" style={{ animationDelay: `${i * 70}ms` }}>
            <button className="group block w-full text-start" onClick={() => onOpen(p.id)}>
              <div className="aspect-[3/4] w-full overflow-hidden border sf-line" style={{ background: p.variants[0]?.colorHex ?? "var(--sf-muted)" }}>
                {p.fallbackImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.fallbackImageUrl} alt={p.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                )}
              </div>
              <div className="sf-display mt-3 text-xl">{p.title}</div>
              <div className="sf-muted text-sm tabular-nums">{money(p.basePrice)}</div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
