import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { HttpError } from "../http/errors";
import { hashPassword, verifyDummy, verifyPassword } from "./password";
import { createSession } from "./session";
import { toSafeUser } from "./guards";

export const loginInput = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});

export const registerInput = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function login(input: z.infer<typeof loginInput>) {
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, input.email)).limit(1);
  if (!user) {
    await verifyDummy(input.password);
    throw new HttpError(401, "Invalid email or password");
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) throw new HttpError(401, "Invalid email or password");
  await createSession({ sub: user.id, role: user.role, email: user.email });
  return toSafeUser(user);
}

/** Public registration always creates a `customer`. Admins are created via seed / admin panel only. */
export async function registerCustomer(input: z.infer<typeof registerInput>) {
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, passwordHash, name: input.name ?? null, role: "customer" })
    .onConflictDoNothing()
    .returning();
  if (!user) throw new HttpError(409, "An account with this email already exists");
  await createSession({ sub: user.id, role: user.role, email: user.email });
  return toSafeUser(user);
}
