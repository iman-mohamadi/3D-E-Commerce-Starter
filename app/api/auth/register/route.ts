import { NextResponse } from "next/server";
import { registerCustomer, registerInput } from "@/server/auth/service";
import { handle, parseJson } from "@/server/http/errors";

export const POST = handle(async (req: Request) => {
  const user = await registerCustomer(await parseJson(req, registerInput));
  return NextResponse.json({ user }, { status: 201 });
});
