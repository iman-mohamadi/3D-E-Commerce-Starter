import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { collections } from "@/db/schema";
import { collectionInput } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { parseJson } from "@/server/http/errors";
import { saveCollection } from "@/server/services/catalog";

export const GET = admin(async () => NextResponse.json({ collections: await db.select().from(collections).orderBy(asc(collections.sortOrder)) }));

export const POST = admin(async (_u, req: Request) => {
  const row = await saveCollection(null, await parseJson(req, collectionInput));
  return NextResponse.json({ collection: row }, { status: 201 });
});
