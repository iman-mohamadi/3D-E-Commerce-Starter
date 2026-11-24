import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { ORDER_TRANSITIONS, orderUpdate } from "@/shared/schemas/admin";
import { admin, idOf, type IdCtx } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";
import { getOrderDetail } from "@/server/services/admin";

export const GET = admin(async (_u, _req: Request, ctx: IdCtx) => {
  const order = await getOrderDetail(await idOf(ctx));
  if (!order) throw new HttpError(404, "Order not found");
  return NextResponse.json({ order });
});

export const PATCH = admin(async (_u, req: Request, ctx: IdCtx) => {
  const id = await idOf(ctx);
  const body = await parseJson(req, orderUpdate);
  const current = await getOrderDetail(id);
  if (!current) throw new HttpError(404, "Order not found");

  const patch: Partial<typeof orders.$inferInsert> = {};
  if (body.status && body.status !== current.status) {
    if (!ORDER_TRANSITIONS[current.status].includes(body.status)) {
      throw new HttpError(409, `Cannot move an order from "${current.status}" to "${body.status}"`);
    }
    patch.status = body.status;
    if (body.status === "shipped" && !(body.trackingNumber ?? current.trackingNumber)) {
      throw new HttpError(422, "Add a tracking number before marking an order as shipped");
    }
  }
  if (body.trackingNumber !== undefined) patch.trackingNumber = body.trackingNumber || null;
  if (Object.keys(patch).length) await db.update(orders).set(patch).where(eq(orders.id, id));
  return NextResponse.json({ order: await getOrderDetail(id) });
});
