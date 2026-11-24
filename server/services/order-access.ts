import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return s;
}

/**
 * Guest access token for an order: HMAC(order number + email). Lets a guest open their confirmation page
 * without an account, carries no personal data, and can't be derived without the server secret.
 */
export function orderToken(orderNumber: string, email: string): string {
  return createHmac("sha256", secret()).update(`order:${orderNumber}:${email.toLowerCase()}`).digest("base64url");
}

export function verifyOrderToken(orderNumber: string, email: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(orderToken(orderNumber, email));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
