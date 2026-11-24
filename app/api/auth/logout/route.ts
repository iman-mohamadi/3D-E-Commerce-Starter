import { NextResponse } from "next/server";
import { destroySession } from "@/server/auth/session";
import { handle } from "@/server/http/errors";

export const POST = handle(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
