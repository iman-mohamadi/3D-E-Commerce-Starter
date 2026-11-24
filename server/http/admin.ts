import { requireAdmin, type SafeUser } from "../auth/guards";
import { handle } from "./errors";

/**
 * Every /api/admin/** route is exported through this wrapper, so `requireAdmin()` can't be forgotten:
 *   export const GET = admin(async (adminUser, req, ctx) => Response.json(...))
 */
export function admin<A extends unknown[]>(fn: (user: SafeUser, ...args: A) => Promise<Response>) {
  return handle(async (...args: A) => {
    const user = await requireAdmin();
    return fn(user, ...args);
  });
}

export type IdCtx = { params: Promise<{ id: string }> };

import { z } from "zod";
import { HttpError } from "./errors";

/** Validates the `[id]` route param as a UUID (400 instead of a Postgres cast error). */
export async function idOf(ctx: IdCtx): Promise<string> {
  const parsed = z.uuid().safeParse((await ctx.params).id);
  if (!parsed.success) throw new HttpError(400, "Invalid id");
  return parsed.data;
}
