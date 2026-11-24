import type { SizeGuide } from "@/shared/schemas/json";

const ORDER = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl", "one size", "os"];

/** Sort sizes by the size guide's row order, then by the usual S-M-L scale, then numerically / alphabetically. */
export function sortSizes(sizes: string[], guide: SizeGuide | null): string[] {
  const fromGuide = new Map((guide?.rows ?? []).map((r, i) => [r.size.toLowerCase(), i]));
  const rank = (s: string) => {
    const k = s.toLowerCase();
    if (fromGuide.has(k)) return fromGuide.get(k)!;
    const o = ORDER.indexOf(k);
    if (o >= 0) return 100 + o;
    const n = parseFloat(k);
    return Number.isFinite(n) ? 200 + n : 1000;
  };
  return [...sizes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
