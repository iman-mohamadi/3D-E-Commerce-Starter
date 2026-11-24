import { NextResponse } from "next/server";
import { hotspotsSync } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";
import { getProductFull, syncHotspots } from "@/server/services/catalog";

export const PUT = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const body = await parseJson(req, hotspotsSync);
  if (!(await getProductFull(id))) throw new HttpError(404, "Product not found");
  return NextResponse.json({ hotspots: await syncHotspots(id, body.hotspots) });
});
