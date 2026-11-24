import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeSettings, studioPresets } from "@/db/schema";
import { presetInput } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";

export const PUT = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const input = await parseJson(req, presetInput);
  const [row] = await db.update(studioPresets).set(input).where(eq(studioPresets.id, id)).returning();
  if (!row) throw new HttpError(404, "Preset not found");
  return NextResponse.json({ preset: row });
});

export const DELETE = admin(async (_u, _req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const [preset] = await db.select().from(studioPresets).where(eq(studioPresets.id, id));
  if (!preset) throw new HttpError(404, "Preset not found");
  const [s] = await db.select({ p: storeSettings.studioThemePreset }).from(storeSettings);
  if (s?.p === preset.slug) throw new HttpError(409, "This preset is the store's studio theme; pick another theme first");
  await db.delete(studioPresets).where(eq(studioPresets.id, id)); // racks using it fall back to no preset (FK set null)
  return NextResponse.json({ ok: true });
});
