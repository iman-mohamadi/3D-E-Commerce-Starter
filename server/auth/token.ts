import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "atelier_session";

export type Role = "admin" | "customer";

export interface SessionClaims {
  sub: string; // user id
  role: Role;
  email: string;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims, days: number): Promise<string> {
  return new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}

/** Edge-safe (jose only). Returns null for missing/invalid/expired tokens. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "admin" && role !== "customer") || typeof payload.email !== "string") return null;
    return { sub: payload.sub, role, email: payload.email };
  } catch {
    return null;
  }
}
