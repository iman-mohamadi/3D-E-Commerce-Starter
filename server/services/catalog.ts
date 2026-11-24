import { and, asc, eq, inArray, max, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { collections, productHotspots, productVariants, products } from "../../db/schema";
import type { HotspotInput, ProductInput, VariantInput } from "../../shared/schemas/admin";

export async function nextRackPosition(collectionId: string | null): Promise<number> {
  if (!collectionId) return 0;
  const [r] = await db.select({ m: max(products.rackPosition) }).from(products).where(eq(products.collectionId, collectionId));
  return (r?.m ?? -1) + 1;
}

export async function createProduct(input: ProductInput) {
  const rackPosition = input.rackPosition ?? (await nextRackPosition(input.collectionId));
  const [row] = await db.insert(products).values({ ...input, rackPosition }).returning();
  return row!;
}

export async function updateProduct(id: string, input: ProductInput) {
  const [current] = await db.select({ collectionId: products.collectionId, rackPosition: products.rackPosition }).from(products).where(eq(products.id, id));
  if (!current) return null;
  // Moving to another rack: append at the end unless a position was given.
  const rackPosition =
    input.rackPosition ?? (input.collectionId !== current.collectionId ? await nextRackPosition(input.collectionId) : current.rackPosition);
  const [row] = await db.update(products).set({ ...input, rackPosition }).where(eq(products.id, id)).returning();
  return row ?? null;
}

export async function getProductFull(id: string) {
  return db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      variants: { orderBy: [asc(productVariants.colorName), asc(productVariants.size)] },
      hotspots: { orderBy: [asc(productHotspots.sortOrder)] },
    },
  });
}

/** Replace the product's variant set: upsert by id, insert new, delete the rest (order items keep their snapshots). */
export async function syncVariants(productId: string, variants: VariantInput[]) {
  return db.transaction(async (tx) => {
    const keepIds = variants.flatMap((v) => (v.id ? [v.id] : []));
    if (keepIds.length) await tx.delete(productVariants).where(and(eq(productVariants.productId, productId), notInArray(productVariants.id, keepIds)));
    else await tx.delete(productVariants).where(eq(productVariants.productId, productId));

    // Park existing rows on throwaway SKU/size values first so swapping SKUs or sizes between rows can't collide mid-sync.
    if (keepIds.length) {
      await tx
        .update(productVariants)
        .set({ sku: sql`'tmp-' || ${productVariants.id}`, size: sql`'tmp-' || ${productVariants.id}` })
        .where(and(eq(productVariants.productId, productId), inArray(productVariants.id, keepIds)));
    }
    for (const v of variants) {
      const { id, ...rest } = v;
      if (id) await tx.update(productVariants).set(rest).where(and(eq(productVariants.id, id), eq(productVariants.productId, productId)));
      else await tx.insert(productVariants).values({ ...rest, productId });
    }
    return tx.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.colorName), asc(productVariants.size));
  });
}

export async function syncHotspots(productId: string, hotspots: HotspotInput[]) {
  return db.transaction(async (tx) => {
    const keepIds = hotspots.flatMap((h) => (h.id ? [h.id] : []));
    if (keepIds.length) await tx.delete(productHotspots).where(and(eq(productHotspots.productId, productId), notInArray(productHotspots.id, keepIds)));
    else await tx.delete(productHotspots).where(eq(productHotspots.productId, productId));
    for (const [i, h] of hotspots.entries()) {
      const { id, ...rest } = h;
      if (id) await tx.update(productHotspots).set({ ...rest, sortOrder: i }).where(and(eq(productHotspots.id, id), eq(productHotspots.productId, productId)));
      else await tx.insert(productHotspots).values({ ...rest, productId, sortOrder: i });
    }
    return tx.select().from(productHotspots).where(eq(productHotspots.productId, productId)).orderBy(asc(productHotspots.sortOrder));
  });
}

/** Persist a drag-and-drop order: array index -> rack_position, scoped to the collection. */
export async function reorderRack(collectionId: string, productIds: string[]) {
  await db.transaction(async (tx) => {
    for (const [i, pid] of productIds.entries()) {
      await tx.update(products).set({ rackPosition: i }).where(and(eq(products.id, pid), eq(products.collectionId, collectionId)));
    }
  });
}

/** Create/update a collection; making it default demotes every other one atomically. */
export async function saveCollection(id: string | null, input: { title: string; slug: string; description: string | null; environmentPreset: string | null; isDefault: boolean; sortOrder: number }) {
  return db.transaction(async (tx) => {
    if (input.isDefault) await tx.update(collections).set({ isDefault: false }).where(id ? sql`${collections.id} <> ${id}` : sql`true`);
    if (id) {
      const [row] = await tx.update(collections).set(input).where(eq(collections.id, id)).returning();
      return row ?? null;
    }
    const [row] = await tx.insert(collections).values(input).returning();
    return row!;
  });
}
