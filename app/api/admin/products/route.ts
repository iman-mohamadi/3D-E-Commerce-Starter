import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { productInput } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { parseJson } from "@/server/http/errors";
import { createProduct } from "@/server/services/catalog";

export const GET = admin(async () => {
  const rows = await db.select().from(products).orderBy(desc(products.createdAt));
  return NextResponse.json({ products: rows });
});

export const POST = admin(async (_user, req: Request) => {
  const input = await parseJson(req, productInput);
  return NextResponse.json({ product: await createProduct(input) }, { status: 201 });
});
