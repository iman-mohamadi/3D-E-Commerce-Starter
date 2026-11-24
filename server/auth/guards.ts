import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { users, type User } from "../../db/schema";
import { forbidden, unauthorized } from "../http/errors";
import { getSession } from "./session";

export type SafeUser = Omit<User, "passwordHash">;

export function toSafeUser(u: User): SafeUser {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}

/**
 * Loads the *current* user row (not just JWT claims), so a deleted user or a demoted
 * admin loses access immediately instead of when the token expires.
 */
export async function currentUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  return user ? toSafeUser(user) : null;
}

/** Customer-or-admin. Throws HttpError(401) for route handlers wrapped in `handle()`. */
export async function requireUser(): Promise<SafeUser> {
  const user = await currentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden();
  return user;
}
