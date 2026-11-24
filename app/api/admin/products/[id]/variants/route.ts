import { NextResponse } from "next/server";
import { variantsSync } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";
import { getProductFull, syncVariants } from "@/server/services/catalog";

/** PUT replaces the product's whole variant matrix (rows with `id` update, without insert, missing are removed). */
export const PUT = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const body = await parseJson(req, variantsSync);
  if (!(await getProductFull(id))) throw new HttpError(404, "Product not found");
  const skus = new Set(body.variants.map((v) => v.sku.toLowerCase()));
  if (skus.size !== body.variants.length) throw new HttpError(422, "Duplicate SKU in matrix");
  return NextResponse.json({ variants: await syncVariants(id, body.variants) });
});
