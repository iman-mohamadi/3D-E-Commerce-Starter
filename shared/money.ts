/**
 * Money helpers. All stored amounts are integer minor units; the store's
 * `currency` + `currency_decimals` (store_settings) say how to show them.
 */
export interface MoneyFormat {
  currency: string;
  decimals: number;
  /** BCP-47 locale for digits/grouping, e.g. "en-US" or "fa-IR". */
  locale?: string;
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 12345 (decimals 2) -> "$123.45" */
export function formatMoney(minor: number, fmt: MoneyFormat): string {
  const major = minor / 10 ** fmt.decimals;
  try {
    return new Intl.NumberFormat(fmt.locale, {
      style: "currency",
      currency: fmt.currency,
      minimumFractionDigits: fmt.decimals,
      maximumFractionDigits: fmt.decimals,
    }).format(major);
  } catch {
    // Unknown / non-ISO currency code: fall back to "123.45 CODE".
    return `${major.toFixed(fmt.decimals)} ${fmt.currency}`;
  }
}

/** Minor units -> editable decimal string in major units ("123.45"). */
export function toMajorString(minor: number, decimals: number): string {
  return (minor / 10 ** decimals).toFixed(decimals);
}

/**
 * User-typed major units -> integer minor units. Accepts Persian/Arabic digits,
 * "," as decimal or grouping separator. Returns null if not a valid non-negative number.
 */
export function parseMoney(input: string | number, decimals: number): number | null {
  let s = String(input).trim();
  if (!s) return null;
  s = s
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[٬\s]/g, "")
    .replace("٫", ".");
  // "1,234.50" -> grouping commas; "12,5" -> decimal comma
  if (/,\d{1,2}$/.test(s) && !s.includes(".")) s = s.replace(",", ".");
  s = s.replace(/,/g, "");
  if (!/^-?\d*\.?\d*$/.test(s) || s === "" || s === "." || s === "-") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10 ** decimals);
}
