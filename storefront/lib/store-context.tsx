"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatMoney } from "@/shared/money";
import { dict, fmt, type Dict, type Locale } from "./i18n";

export interface Customer {
  name: string | null;
  email: string;
  role: "admin" | "customer";
}

export interface StoreContextValue {
  brand: string;
  logoUrl: string | null;
  locale: Locale;
  rtl: boolean;
  intl: string;
  currency: string;
  decimals: number;
  t: Dict;
  money: (minor: number) => string;
  fmtNum: (n: number) => string;
  /** wraps a composite number/price string in a left-to-right isolate so signs and symbols keep their place in RTL text */
  iso: (s: string) => string;
  /** t(key) with {placeholders} */
  tf: (key: keyof Dict, vars: Record<string, string | number>) => string;
  customer: Customer | null;
}

/** Unicode bidi isolates: keep numbers / prices in left-to-right order inside right-to-left text. */
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);

const Ctx = createContext<StoreContextValue | null>(null);

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

interface Props {
  brand: string;
  logoUrl: string | null;
  locale: Locale;
  direction: "ltr" | "rtl";
  currency: string;
  decimals: number;
  customer: Customer | null;
  children: ReactNode;
}

/** Brand / locale / currency from store_settings, shared by every storefront page (cart drawer, checkout, account...). */
export function StoreProvider({ brand, logoUrl, locale, direction, currency, decimals, customer, children }: Props) {
  const value = useMemo<StoreContextValue>(() => {
    const intl = locale === "fa" ? "fa-IR" : "en-US";
    const t = dict(locale);
    return {
      brand,
      logoUrl,
      locale,
      rtl: direction === "rtl",
      intl,
      currency,
      decimals,
      t,
      money: (m) => formatMoney(m, { currency, decimals, locale: intl }),
      fmtNum: (n) => new Intl.NumberFormat(intl).format(n),
      iso: (s) => `${LRI}${s}${PDI}`,
      tf: (k, vars) => fmt(t[k], Object.fromEntries(Object.entries(vars).map(([key, v]) => [key, `${LRI}${v}${PDI}`]))),
      customer,
    };
  }, [brand, logoUrl, locale, direction, currency, decimals, customer]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
