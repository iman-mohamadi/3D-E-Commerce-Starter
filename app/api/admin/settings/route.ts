import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeSettings } from "@/db/schema";
import { settingsInput } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";
import { getSettings } from "@/server/services/admin";

export const GET = admin(async () => NextResponse.json({ settings: await getSettings() }));

/** The settings row is a singleton created by the seed; PUT edits it (brand_theme editing arrives with the storefront theme work). */
export const PUT = admin(async (_u, req: Request) => {
  const input = await parseJson(req, settingsInput);
  const [row] = await db.update(storeSettings).set(input).where(eq(storeSettings.id, 1)).returning();
  if (!row) throw new HttpError(409, "Store settings row is missing; run `npm run db:seed` first");
  return NextResponse.json({ settings: row });
});
