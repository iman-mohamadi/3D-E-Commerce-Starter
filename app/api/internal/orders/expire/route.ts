import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { env } from "@/server/config/env";
import { HttpError, handle } from "@/server/http/errors";
import { expirePendingOrders } from "@/server/services/orders";

const sha = (s: string) => createHash("sha256").update(s).digest();

function authorize(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) throw new HttpError(503, "Expiry endpoint is disabled: set CRON_SECRET");
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // hash both sides so the comparison is constant-time regardless of length
  if (!timingSafeEqual(sha(given), sha(secret))) throw new HttpError(401, "Invalid or missing bearer token");
}

const run = handle(async (req: Request) => {
  authorize(req);
  const result = await expirePendingOrders(db, env().ORDER_EXPIRY_MINUTES);
  return NextResponse.json({ ...result, ttlMinutes: env().ORDER_EXPIRY_MINUTES }, { headers: { "Cache-Control": "no-store" } });
});

/**
 * Cancels unpaid pending orders past ORDER_EXPIRY_MINUTES and releases their stock + coupon uses.
 * `Authorization: Bearer $CRON_SECRET`. POST for generic cron / Docker; GET because Vercel Cron issues GET requests.
 */
export const POST = run;
export const GET = run;
