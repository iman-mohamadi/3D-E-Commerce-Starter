import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth/guards";
import { handle } from "@/server/http/errors";

export const GET = handle(async () => NextResponse.json({ user: await currentUser() }));
