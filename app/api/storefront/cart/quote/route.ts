import { NextResponse } from "next/server";
import { quoteInput } from "@/shared/schemas/checkout";
import { handle, parseJson } from "@/server/http/errors";
import { db } from "@/db/client";
import { priceCart } from "@/server/services/pricing";

/** Authoritative cart pricing. The browser sends only { variantId, quantity } + a coupon code; everything else is re-read. */
export const POST = handle(async (req: Request) => {
  const input = await parseJson(req, quoteInput);
  const { quote } = await priceCart(db, input);
  return NextResponse.json({ quote }, { headers: { "Cache-Control": "no-store" } });
});
