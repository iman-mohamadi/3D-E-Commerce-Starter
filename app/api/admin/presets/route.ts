import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { studioPresets } from "@/db/schema";
import { presetInput } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { parseJson } from "@/server/http/errors";

export const GET = admin(async () => NextResponse.json({ presets: await db.select().from(studioPresets).orderBy(asc(studioPresets.name)) }));

export const POST = admin(async (_u, req: Request) => {
  const input = await parseJson(req, presetInput);
  const [row] = await db.insert(studioPresets).values(input).returning();
  return NextResponse.json({ preset: row }, { status: 201 });
});
