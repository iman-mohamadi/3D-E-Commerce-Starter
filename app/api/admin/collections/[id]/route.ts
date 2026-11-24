import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { collections } from "@/db/schema";
import { collectionInput } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";
import { saveCollection } from "@/server/services/catalog";

export const PATCH = admin(async (_u, req: Request, ctx: IdCtx) => {
  const row = await saveCollection(await idOf(ctx), await parseJson(req, collectionInput));
  if (!row) throw new HttpError(404, "Rack not found");
  return NextResponse.json({ collection: row });
});

/** Products in the rack are kept (collection_id -> null); they just leave the rack. */
export const DELETE = admin(async (_u, _req: Request, ctx: IdCtx) => {
  const [row] = await db.delete(collections).where(eq(collections.id, await idOf(ctx))).returning({ id: collections.id });
  if (!row) throw new HttpError(404, "Rack not found");
  return NextResponse.json({ ok: true });
});
