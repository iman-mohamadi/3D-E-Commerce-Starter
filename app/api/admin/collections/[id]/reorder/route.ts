import { NextResponse } from "next/server";
import { reorderInput } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { parseJson } from "@/server/http/errors";
import { reorderRack } from "@/server/services/catalog";

export const PUT = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const { productIds } = await parseJson(req, reorderInput);
  await reorderRack(id, productIds);
  return NextResponse.json({ ok: true });
});
