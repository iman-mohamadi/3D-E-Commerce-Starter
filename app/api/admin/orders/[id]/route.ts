import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { orderUpdate } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";
import { getOrderDetail } from "@/server/services/admin";
import { updateOrderAdmin } from "@/server/services/orders";

export const GET = admin(async (_u, _req: Request, ctx: IdCtx) => {
  const order = await getOrderDetail(await idOf(ctx));
  if (!order) throw new HttpError(404, "Order not found");
  return NextResponse.json({ order });
});

/** Status changes go through updateOrderAdmin: allowed-transition map + compare-and-set; Cancelled restores stock once. */
export const PATCH = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const body = await parseJson(req, orderUpdate);
  await updateOrderAdmin(db, id, body);
  return NextResponse.json({ order: await getOrderDetail(id) });
});
