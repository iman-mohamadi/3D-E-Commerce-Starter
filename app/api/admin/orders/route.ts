import { NextResponse } from "next/server";
import { orderStatusValues } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { listOrders } from "@/server/services/admin";

export const GET = admin(async (_u, req: Request) => {
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const valid = status && (orderStatusValues as readonly string[]).includes(status) ? status : undefined;
  return NextResponse.json({ orders: await listOrders({ status: valid }) });
});
