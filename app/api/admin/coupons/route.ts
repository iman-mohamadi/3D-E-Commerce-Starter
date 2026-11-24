import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { coupons } from "@/db/schema";
import { couponInput } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { parseJson } from "@/server/http/errors";

export const GET = admin(async () => NextResponse.json({ coupons: await db.select().from(coupons).orderBy(desc(coupons.createdAt)) }));

export const POST = admin(async (_u, req: Request) => {
  const input = await parseJson(req, couponInput);
  const [row] = await db.insert(coupons).values(input).returning();
  return NextResponse.json({ coupon: row }, { status: 201 });
});
