import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guards";
import { handle } from "@/server/http/errors";

/** Example of the admin guard pattern: proxy.ts is the coarse gate, requireAdmin() is the real one. */
export const GET = handle(async () => {
  const admin = await requireAdmin();
  return NextResponse.json({ ok: true, admin: admin.email });
});
