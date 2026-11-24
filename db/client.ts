import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { pgOptions } from "./options";

// Reuse the connection across Next.js dev hot reloads.
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };

export function createSql(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, pgOptions());
}

const pg = g.__pg ?? createSql();
if (process.env.NODE_ENV !== "production") g.__pg = pg;

export const db = drizzle(pg, { schema });
export type Db = typeof db;
export { schema, pg };
