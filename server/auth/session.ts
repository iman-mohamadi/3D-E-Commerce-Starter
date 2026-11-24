import { cookies } from "next/headers";
import { env } from "../config/env";
import { SESSION_COOKIE, signSession, verifySession, type SessionClaims } from "./token";

export async function createSession(claims: SessionClaims) {
  const days = env().AUTH_SESSION_DAYS;
  const token = await signSession(claims, days);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionClaims | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
