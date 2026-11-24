/**
 * npm run orders:expire [-- --ttl 45]
 * Cancels unpaid pending orders older than ORDER_EXPIRY_MINUTES (default 30) and releases their stock + coupon uses.
 * Safe to run from cron, a Docker sidecar, or by hand; repeated and concurrent runs are idempotent.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { pgOptions } from "../db/options";
import { expirePendingOrders } from "../server/services/orders";

const arg = process.argv.indexOf("--ttl");
const ttl = Number(arg > -1 ? process.argv[arg + 1] : (process.env.ORDER_EXPIRY_MINUTES ?? 30));
if (!Number.isFinite(ttl) || ttl < 1) {
  console.error("Invalid TTL. Use ORDER_EXPIRY_MINUTES or --ttl <minutes>.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { ...pgOptions(), max: Number(process.env.DATABASE_POOL_MAX ?? 1) });
try {
  const res = await expirePendingOrders(drizzle(client, { schema }), ttl);
  console.log(`Expired ${res.expired} pending order(s) older than ${ttl} min.${res.numbers.length ? " " + res.numbers.join(", ") : ""}`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await client.end();
}
