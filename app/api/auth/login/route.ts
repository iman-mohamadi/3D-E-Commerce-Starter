import { NextResponse } from "next/server";
import { loginInput, login } from "@/server/auth/service";
import { handle, parseJson } from "@/server/http/errors";
import { clientIp, enforceRateLimit, resetRateLimit } from "@/server/security/rate-limit";
import { LIMITS } from "@/server/security/policies";

/** Serves customers and the admin sign-in form. Rate limited per address and per target account. */
export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  await enforceRateLimit(LIMITS.loginIp, ip);
  const input = await parseJson(req, loginInput);
  await enforceRateLimit(LIMITS.loginAccount, `${ip}|${input.email}`);
  const user = await login(input);
  await resetRateLimit(LIMITS.loginAccount, `${ip}|${input.email}`); // a successful sign-in clears the account counter
  return NextResponse.json({ user });
});
