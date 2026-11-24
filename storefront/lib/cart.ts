"use client";

import { useSyncExternalStore } from "react";

/**
 * One line per variant. Prices here are display snapshots only: the server re-prices everything
 * (/api/storefront/cart/quote and checkout) from the database.
 */
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

interface CartState {
  lines: CartLine[];
  coupon: string;
}

const KEY = "atelier-cart-v1";
const MAX_QTY = 10;
const EMPTY: CartState = { lines: [], coupon: "" };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isLine(x: unknown): x is CartLine {
  const l = x as CartLine;
  return !!l && typeof l.variantId === "string" && typeof l.productId === "string" && typeof l.sku === "string" && Number.isInteger(l.unitPrice) && Number.isInteger(l.quantity) && l.quantity > 0;
}

function parse(raw: string | null): CartState {
  try {
    const o = JSON.parse(raw ?? "null");
    if (o?.v === 1 && Array.isArray(o.lines)) return { lines: o.lines.filter(isLine), coupon: typeof o.coupon === "string" ? o.coupon.slice(0, 40) : "" };
  } catch {
    /* corrupt storage: start empty */
  }
  return EMPTY;
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = parse(localStorage.getItem(KEY));
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = parse(e.newValue); // keep tabs in sync
    emit(false);
  });
}

function emit(persist = true) {
  if (persist) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, ...state }));
    } catch {
      /* storage full / disabled: the cart still works for this session */
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
  return state;
};
const getServerSnapshot = () => EMPTY;

export const cart = {
  add(line: Omit<CartLine, "quantity">, qty = 1) {
    load();
    const i = state.lines.findIndex((l) => l.variantId === line.variantId);
    const lines =
      i >= 0
        ? state.lines.map((l, j) => (j === i ? { ...l, ...line, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l))
        : [...state.lines, { ...line, quantity: Math.min(MAX_QTY, qty) }];
    state = { ...state, lines };
    emit();
  },
  setQuantity(variantId: string, quantity: number) {
    load();
    const lines = quantity <= 0 ? state.lines.filter((l) => l.variantId !== variantId) : state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l));
    state = { ...state, lines };
    emit();
  },
  remove(variantId: string) {
    cart.setQuantity(variantId, 0);
  },
  removeMany(variantIds: string[]) {
    load();
    const drop = new Set(variantIds);
    state = { ...state, lines: state.lines.filter((l) => !drop.has(l.variantId)) };
    emit();
  },
  setCoupon(code: string) {
    load();
    state = { ...state, coupon: code.trim().toUpperCase().slice(0, 40) };
    emit();
  },
  clear() {
    state = EMPTY;
    emit();
  },
};

/** React binding (SSR-safe: empty on the server and the first client render). */
export function useCart() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    lines: s.lines,
    coupon: s.coupon,
    count: s.lines.reduce((n, x) => n + x.quantity, 0),
    /** display-only estimate; use the server quote for anything authoritative */
    estimate: s.lines.reduce((n, x) => n + x.quantity * x.unitPrice, 0),
    ...cart,
  };
}
