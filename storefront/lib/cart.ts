"use client";

import { useSyncExternalStore } from "react";

/** One line per variant. Prices are snapshots for display; Phase 4 re-prices on the server at checkout. */
export interface CartLine {
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  sku: string;
  colorName: string;
  colorHex: string;
  size: string;
  unitPrice: number; // minor units
  quantity: number;
  image: string | null;
}

const KEY = "atelier-cart-v1";
const MAX_QTY = 10;
const EMPTY: CartLine[] = [];

let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isLine(x: unknown): x is CartLine {
  const l = x as CartLine;
  return !!l && typeof l.variantId === "string" && typeof l.productId === "string" && typeof l.sku === "string" && Number.isInteger(l.unitPrice) && Number.isInteger(l.quantity) && l.quantity > 0;
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw?.v === 1 && Array.isArray(raw.lines)) lines = raw.lines.filter(isLine);
  } catch {
    lines = EMPTY;
  }
  // keep tabs in sync
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      const raw = JSON.parse(e.newValue ?? "null");
      lines = raw?.v === 1 && Array.isArray(raw.lines) ? raw.lines.filter(isLine) : EMPTY;
    } catch {
      lines = EMPTY;
    }
    emit(false);
  });
}

function emit(persist = true) {
  if (persist) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, lines }));
    } catch {
      /* storage full / disabled: cart still works for this session */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => {
  load();
  return lines;
};
const getServerSnapshot = () => EMPTY;

export const cart = {
  add(line: Omit<CartLine, "quantity">, qty = 1) {
    load();
    const i = lines.findIndex((l) => l.variantId === line.variantId);
    lines =
      i >= 0
        ? lines.map((l, j) => (j === i ? { ...l, ...line, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l))
        : [...lines, { ...line, quantity: Math.min(MAX_QTY, qty) }];
    emit();
  },
  setQuantity(variantId: string, quantity: number) {
    load();
    lines = quantity <= 0 ? lines.filter((l) => l.variantId !== variantId) : lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l));
    emit();
  },
  remove(variantId: string) {
    cart.setQuantity(variantId, 0);
  },
  clear() {
    lines = EMPTY;
    emit();
  },
};

/** React binding (SSR-safe: empty on the server and first client render). */
export function useCart() {
  const l = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    lines: l,
    count: l.reduce((n, x) => n + x.quantity, 0),
    subtotal: l.reduce((n, x) => n + x.quantity * x.unitPrice, 0),
    ...cart,
  };
}
