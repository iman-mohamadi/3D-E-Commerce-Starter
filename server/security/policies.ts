import type { Rule } from "./rate-limit";

const MIN = 60_000;

/**
 * Central rate-limit policy. Tune here; every protected route imports its rule from this file.
 * The same /api/auth/login serves customers and the admin sign-in form, so it covers both.
 */
export const LIMITS = {
  /** per client address */
  loginIp: { name: "login-ip", limit: 20, windowMs: 10 * MIN },
  /** per target account: stops slow password guessing from many addresses */
  loginAccount: { name: "login-acct", limit: 8, windowMs: 10 * MIN },
  registerIp: { name: "register-ip", limit: 10, windowMs: 60 * MIN },
  orderLookupIp: { name: "lookup-ip", limit: 15, windowMs: 10 * MIN },
  /** per order number: stops enumerating emails against one order */
  orderLookupOrder: { name: "lookup-order", limit: 6, windowMs: 10 * MIN },
} satisfies Record<string, Rule>;
