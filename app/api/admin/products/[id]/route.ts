import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { productInput } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";
import { getProductFull, updateProduct } from "@/server/services/catalog";

export const GET = admin(async (_u, _req: Request, ctx: IdCtx) => {
  const product = await getProductFull(await idOf(ctx));
  if (!product) throw new HttpError(404, "Product not found");
  return NextResponse.json({ product });
});

export const PATCH = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const product = await updateProduct(id, await parseJson(req, productInput));
  if (!product) throw new HttpError(404, "Product not found");
  return NextResponse.json({ product });
});

export const DELETE = admin(async (_u, _req: Request, ctx: IdCtx) => {
  const [row] = await db.delete(products).where(eq(products.id, await idOf(ctx))).returning({ id: products.id });
  if (!row) throw new HttpError(404, "Product not found");
  return NextResponse.json({ ok: true });
});
