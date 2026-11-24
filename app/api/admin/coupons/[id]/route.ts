import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { coupons } from "@/db/schema";
import { couponInput } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";

export const PATCH = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const input = await parseJson(req, couponInput);
  const [row] = await db.update(coupons).set(input).where(eq(coupons.id, id)).returning();
  if (!row) throw new HttpError(404, "Coupon not found");
  return NextResponse.json({ coupon: row });
});

export const DELETE = admin(async (_u, _req: Request, ctx: IdCtx) => {
  const [row] = await db.delete(coupons).where(eq(coupons.id, await idOf(ctx))).returning({ id: coupons.id });
  if (!row) throw new HttpError(404, "Coupon not found");
  return NextResponse.json({ ok: true });
});
