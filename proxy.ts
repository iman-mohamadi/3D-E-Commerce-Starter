import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./server/auth/token";

/**
 * Coarse, fast gate (Next 16 `proxy`, formerly `middleware`): checks the signed cookie only.
 * Real authorization is re-checked against the DB by `requireAdmin()` / `requireUser()`
 * inside every route handler and server action — never rely on this file alone.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  const deny = (status: 401 | 403) =>
    isApi
      ? NextResponse.json({ error: status === 401 ? "Authentication required" : "Insufficient permissions" }, { status })
      : NextResponse.redirect(new URL(status === 401 ? `/login?next=${encodeURIComponent(pathname)}` : "/", req.url));

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!session) return deny(401);
    if (session.role !== "admin") return deny(403);
  }

  if (pathname.startsWith("/account") || pathname.startsWith("/api/account")) {
    if (!session) return deny(401);
  }

  return NextResponse.next();
}

export const config = {
  // /api/admin/uploads is excluded because the proxy buffers request bodies (10 MB cap) and GLBs are larger;
  // that route enforces requireAdmin() itself like every other admin route.
  matcher: ["/admin/:path*", "/api/admin/((?!uploads).*)", "/account/:path*", "/api/account/:path*"],
};
