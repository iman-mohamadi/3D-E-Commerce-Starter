import { NextResponse } from "next/server";
import { loginInput, login } from "@/server/auth/service";
import { handle, parseJson } from "@/server/http/errors";

export const POST = handle(async (req: Request) => {
  const user = await login(await parseJson(req, loginInput));
  return NextResponse.json({ user });
});
