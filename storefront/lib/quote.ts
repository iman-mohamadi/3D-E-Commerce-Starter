"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { QuoteResponse } from "@/shared/schemas/checkout";
import { cart, type CartLine } from "./cart";

export interface QuoteState {
  quote: QuoteResponse | null;
  loading: boolean;
  error: boolean;
  /** set when the server changed quantities/availability compared to what the cart held */
  adjusted: Record<string, number>;
  refresh: () => void;
}

/**
 * Asks the server to price the bag (debounced). The server's answer is authoritative: if stock dropped,
 * the cart quantities are corrected to what can actually be bought and the change is surfaced via `adjusted`.
 */
export function useQuote(lines: CartLine[], coupon: string, enabled = true): QuoteState {
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [adjusted, setAdjusted] = useState<Record<string, number>>({});
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  const key = useMemo(() => JSON.stringify([lines.map((l) => [l.variantId, l.quantity]), coupon]), [lines, coupon]);

  useEffect(() => {
    if (!enabled) return;
    if (lines.length === 0) {
      setQuote(null);
      setAdjusted({});
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/storefront/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), couponCode: coupon || undefined }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { quote: q } = (await res.json()) as { quote: QuoteResponse };
        if (mine !== seq.current) return; // a newer request superseded this one
        setQuote(q);
        setError(false);

        const adj: Record<string, number> = {};
        for (const l of q.lines) if (l.status === "reduced") adj[l.variantId] = l.quantity;
        setAdjusted(adj);
        for (const [id, qty] of Object.entries(adj)) cart.setQuantity(id, qty); // correct the cart to what can be bought
      } catch {
        if (mine === seq.current) setError(true);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce]);

  return { quote, loading, error, adjusted, refresh: () => setNonce((n) => n + 1) };
}
