import type { Options } from "postgres";

/**
 * Connection options shared by the app, migrations, seed and CLI scripts.
 *  DATABASE_POOL_MAX     max pooled connections (default 10)
 *  DATABASE_FETCH_TYPES  set to "false" for the in-memory PGlite dev server (`npm run dev:db`), whose wire
 *                        protocol layer can't answer postgres-js's startup type lookup. Real Postgres: leave unset.
 */
export function pgOptions(): Options<Record<string, never>> {
  return {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    fetch_types: process.env.DATABASE_FETCH_TYPES !== "false",
  };
}
