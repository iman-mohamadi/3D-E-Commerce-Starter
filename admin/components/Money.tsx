"use client";

import { useAdmin } from "../lib/context";

/** Renders integer minor units using the store's currency/decimals (usable from server components). */
export function Money({ minor }: { minor: number }) {
  return <>{useAdmin().money(minor)}</>;
}
