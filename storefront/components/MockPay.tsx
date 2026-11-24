"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "../lib/store-context";

function Inner() {
  const { t, money } = useStore();
  const p = useSearchParams();
  const order = p.get("order") ?? "";
  const reference = p.get("reference") ?? "";
  const amount = Number(p.get("amount") ?? "0");
  const ret = p.get("return") ?? "";

  // only ever return to this site's own payment-return endpoint (computed after mount: needs window.location)
  const [safe, setSafe] = useState<URL | null>(null);
  useEffect(() => {
    try {
      const u = new URL(ret, window.location.origin);
      setSafe(u.origin === window.location.origin && u.pathname === "/api/storefront/payments/return" ? u : null);
    } catch {
      setSafe(null);
    }
  }, [ret]);

  const go = (status: "paid" | "failed") => {
    if (!safe) return;
    safe.searchParams.set("reference", reference);
    safe.searchParams.set("mock_status", status);
    window.location.assign(safe.toString());
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-5">
      <div className="sf-panel w-full space-y-6 p-8">
        <div>
          <p className="sf-label sf-accent">{t.mockTitle}</p>
          <h1 className="sf-display mt-2 text-4xl">{order}</h1>
        </div>
        <div className="flex items-baseline justify-between border-y py-4 sf-line">
          <span className="sf-label">{t.amountDue}</span>
          <span className="sf-display text-3xl tabular-nums">{money(amount)}</span>
        </div>
        <p className="sf-muted text-sm">{t.mockNote}</p>
        <div className="grid gap-3">
          <button className="sf-btn sf-btn-primary" disabled={!safe || !reference} onClick={() => go("paid")}>{t.mockApprove}</button>
          <button className="sf-btn" disabled={!safe || !reference} onClick={() => go("failed")}>{t.mockFail}</button>
        </div>
      </div>
    </main>
  );
}

export function MockPay() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
