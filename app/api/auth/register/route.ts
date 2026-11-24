import { NextResponse } from "next/server";
import { registerCustomer, registerInput } from "@/server/auth/service";
import { handle, parseJson } from "@/server/http/errors";
import { clientIp, enforceRateLimit } from "@/server/security/rate-limit";
import { LIMITS } from "@/server/security/policies";

export const POST = handle(async (req: Request) => {
  await enforceRateLimit(LIMITS.registerIp, clientIp(req));
  const user = await registerCustomer(await parseJson(req, registerInput));
  return NextResponse.json({ user }, { status: 201 });
});
