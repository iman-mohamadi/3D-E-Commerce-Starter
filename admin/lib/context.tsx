"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatMoney, parseMoney, toMajorString } from "@/shared/money";

export interface AdminContextValue {
  currency: string;
  decimals: number;
  locale: string;
  /** Prefix that turns a storage key into a URL (local: /api/files/, S3: CDN/bucket). */
  assetBase: string;
  money: (minor: number) => string;
  /** user-typed major units -> minor (null if invalid) */
  toMinor: (input: string) => number | null;
  toMajor: (minor: number) => string;
  assetUrl: (keyOrUrl: string | null | undefined) => string | null;
  notify: (message: string, kind?: "ok" | "error") => void;
}

const Ctx = createContext<AdminContextValue | null>(null);

export function useAdmin() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin must be used inside <AdminProvider>");
  return v;
}

export function AdminProvider(props: { currency: string; decimals: number; locale: string; assetBase: string; children: ReactNode }) {
  const { currency, decimals, locale, assetBase } = props;
  const [toast, setToast] = useState<{ id: number; message: string; kind: "ok" | "error" } | null>(null);

  const notify = useCallback((message: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now();
    setToast({ id, message, kind });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4500);
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({
      currency,
      decimals,
      locale,
      assetBase,
      money: (m) => formatMoney(m, { currency, decimals, locale }),
      toMinor: (s) => parseMoney(s, decimals),
      toMajor: (m) => toMajorString(m, decimals),
      assetUrl: (k) => (!k ? null : /^(https?:)?\/\//.test(k) || k.startsWith("/") ? k : `${assetBase}${k}`),
      notify,
    }),
    [currency, decimals, locale, assetBase, notify],
  );

  return (
    <Ctx.Provider value={value}>
      {props.children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-sm border px-4 py-3 text-sm shadow-xl ${
            toast.kind === "error" ? "border-red-800 bg-red-950 text-red-200" : "border-gold/50 bg-raised text-bone"
          }`}
        >
          {toast.message}
        </div>
      )}
    </Ctx.Provider>
  );
}
