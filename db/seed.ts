/**
 * npm run db:seed          fill in whatever is missing (never overwrites admin edits)
 * npm run db:reset         truncate everything, then seed
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { DARK_ATELIER_PRESET, SEED_COLLECTION, SEED_COUPONS, SEED_PRODUCTS, SEED_SETTINGS, variantRowsFor } from "./seed/data";
import { hashPassword } from "../server/auth/password";

const reset = process.argv.includes("--reset");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });
const { users, studioPresets, storeSettings, collections, products, productVariants, productHotspots, coupons } = schema;

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email)).limit(1);
  if (existing) return console.log(`  admin    ${email} already exists`);

  const fromEnv = process.env.SEED_ADMIN_PASSWORD;
  const password = fromEnv || randomBytes(12).toString("base64url");
  await db.insert(users).values({ email, passwordHash: await hashPassword(password), name: "Store Admin", role: "admin" });
  console.log(`  admin    created ${email}`);
  if (!fromEnv) console.log(`           generated password (shown once): ${password}`);
}

async function main() {
  if (reset) {
    console.log("Resetting database...");
    await db.execute(
      sql`TRUNCATE order_items, orders, coupons, product_hotspots, product_variants, products, collections, store_settings, studio_presets, users RESTART IDENTITY CASCADE`,
    );
  }

  console.log("Seeding...");
  await db.transaction(async (tx) => {
    // Order matters: presets -> settings/collections -> products -> children.
    await tx.insert(studioPresets).values(DARK_ATELIER_PRESET).onConflictDoNothing();

    await tx
      .insert(storeSettings)
      .values({ id: 1, ...SEED_SETTINGS, studioThemePreset: DARK_ATELIER_PRESET.slug })
      .onConflictDoNothing();

    await tx.insert(collections).values(SEED_COLLECTION).onConflictDoNothing();
    const [rack] = await tx.select({ id: collections.id }).from(collections).where(eq(collections.slug, SEED_COLLECTION.slug));
    if (!rack) throw new Error("Default collection missing after insert");

    for (const p of SEED_PRODUCTS) {
      const [row] = await tx
        .insert(products)
        .values({
          title: p.title,
          slug: p.slug,
          description: p.description,
          basePrice: p.basePrice,
          glbUrl: null, // procedural fallback until a .glb is uploaded via the Studio CMS
          fallbackImageUrl: null,
          collectionId: rack.id,
          rackPosition: p.rackPosition,
          transformConfig: p.transform,
          proceduralConfig: p.procedural,
          sizeGuide: p.sizeGuide,
        })
        .onConflictDoNothing()
        .returning({ id: products.id });

      if (!row) {
        console.log(`  product  ${p.slug} exists, skipped`);
        continue;
      }
      await tx.insert(productVariants).values(variantRowsFor(p).map((v) => ({ ...v, productId: row.id })));
      await tx.insert(productHotspots).values(
        p.hotspots.map((h, i) => ({
          productId: row.id,
          label: h.label,
          description: h.description,
          position3d: h.position,
          cameraOffset: h.cameraOffset,
          sortOrder: i,
        })),
      );
      console.log(`  product  ${p.slug} (${p.colors.length * p.sizes.length} variants, ${p.hotspots.length} hotspots)`);
    }

    await tx.insert(coupons).values(SEED_COUPONS).onConflictDoNothing();
  });

  await seedAdmin();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
