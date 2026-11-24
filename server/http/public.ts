import { NextResponse } from "next/server";

/** Cache-friendly JSON for public read-only endpoints: shared caches 60s, serve stale up to 5 min while revalidating. */
export function publicJson(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
