/**
 * Zero-install dev database: an in-memory PGlite Postgres served over the Postgres wire protocol,
 * migrated and seeded with the demo store (admin password printed). Data is lost on exit.
 *
 *   npm run dev:db            # terminal 1  -> postgres://postgres:postgres@localhost:5434/postgres
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5434/postgres npm run dev   # terminal 2
 *
 * For anything you want to keep, use a real Postgres (docker compose up -d db).
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";
import { DARK_ATELIER_PRESET, SEED_COLLECTION, SEED_COUPONS, SEED_PRODUCTS, SEED_SETTINGS, variantRowsFor } from "../db/seed/data";
import { hashPassword } from "../server/auth/password";

const port = Number(process.env.DEV_DB_PORT ?? 5434);
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.SEED_ADMIN_PASSWORD ?? "dev-admin-password";

const client = new PGlite();
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: "./drizzle" });

await db.insert(schema.studioPresets).values(DARK_ATELIER_PRESET);
await db.insert(schema.storeSettings).values({ id: 1, ...SEED_SETTINGS, studioThemePreset: DARK_ATELIER_PRESET.slug });
const [rack] = await db.insert(schema.collections).values(SEED_COLLECTION).returning();
for (const p of SEED_PRODUCTS) {
  const [row] = await db
    .insert(schema.products)
    .values({ title: p.title, slug: p.slug, description: p.description, basePrice: p.basePrice, collectionId: rack!.id, rackPosition: p.rackPosition, transformConfig: p.transform, proceduralConfig: p.procedural, sizeGuide: p.sizeGuide })
    .returning();
  await db.insert(schema.productVariants).values(variantRowsFor(p).map((v) => ({ ...v, productId: row!.id })));
  await db.insert(schema.productHotspots).values(p.hotspots.map((h, i) => ({ productId: row!.id, label: h.label, description: h.description, position3d: h.position, cameraOffset: h.cameraOffset, sortOrder: i })));
}
await db.insert(schema.coupons).values(SEED_COUPONS);
await db.insert(schema.users).values({ email, passwordHash: await hashPassword(password), name: "Store Admin", role: "admin" });

const server = new PGLiteSocketServer({ db: client, port, host: "127.0.0.1", maxConnections: 20 });
await server.start();
console.log(`In-memory Postgres ready on postgres://postgres:postgres@127.0.0.1:${port}/postgres`);
console.log("Run the app with: DATABASE_POOL_MAX=1 DATABASE_FETCH_TYPES=false");
console.log(`Admin login: ${email} / ${password}   (demo coupons: WELCOME10, ATELIER25)`);
process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
