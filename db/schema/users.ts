import { pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, timestamps } from "./_common";

export const userRole = pgEnum("user_role", ["admin", "customer"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    role: userRole("role").notNull().default("customer"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
