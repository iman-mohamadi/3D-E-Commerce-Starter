import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { collections, productHotspots, productVariants, products, storeSettings, studioPresets } from "../../db/schema";
import type { PublicPreset, PublicProduct, PublicRack, PublicSettings, StorefrontData } from "../../shared/storefront";
import { storage } from "../adapters/storage";

/** Storage key -> public URL (absolute / root-relative URLs pass through). */
function asset(k: string | null): string | null {
  if (!k) return null;
  return /^(https?:)?\/\//.test(k) || k.startsWith("/") ? k : storage().publicUrl(k);
}

export async function getPublicSettings(): Promise<PublicSettings | null> {
  const [s] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1));
  if (!s) return null;
  return {
    brandName: s.brandName,
    tagline: s.tagline,
    logoUrl: asset(s.logoUrl),
    faviconUrl: asset(s.faviconUrl),
    brandTheme: s.brandTheme,
    currency: s.currency,
    currencyDecimals: s.currencyDecimals,
    defaultLocale: s.defaultLocale,
    direction: s.direction,
    studioThemePreset: s.studioThemePreset,
    lightingOverride: s.lightingConfig,
    freeShippingThreshold: s.freeShippingThreshold,
    flatShippingRate: s.flatShippingRate,
  };
}

async function presetMap(): Promise<Map<string, PublicPreset>> {
  const rows = await db.select().from(studioPresets);
  return new Map(rows.map((p) => [p.slug, { slug: p.slug, name: p.name, config: p.config }]));
}

/** Racks (collections) with their resolved studio preset. `withProducts` adds active products incl. variants + hotspots. */
export async function getPublicRacks(opts: { slug?: string; withProducts?: boolean } = {}): Promise<PublicRack[]> {
  const settings = await getPublicSettings();
  const [presets, cols] = await Promise.all([
    presetMap(),
    db.select().from(collections).where(opts.slug ? eq(collections.slug, opts.slug) : undefined).orderBy(asc(collections.sortOrder), asc(collections.title)),
  ]);
  const fallbackPreset = (settings && presets.get(settings.studioThemePreset)) ?? [...presets.values()][0] ?? null;

  let byCollection = new Map<string, PublicProduct[]>();
  if (opts.withProducts && cols.length) {
    const prods = await db
      .select()
      .from(products)
      .where(and(eq(products.isActive, true), inArray(products.collectionId, cols.map((c) => c.id))))
      .orderBy(asc(products.rackPosition), asc(products.title));
    const ids = prods.map((p) => p.id);
    const [vars, spots] = ids.length
      ? await Promise.all([
          db.select().from(productVariants).where(inArray(productVariants.productId, ids)).orderBy(asc(productVariants.colorName), asc(productVariants.size)),
          db.select().from(productHotspots).where(inArray(productHotspots.productId, ids)).orderBy(asc(productHotspots.sortOrder)),
        ])
      : [[], []];

    byCollection = new Map();
    for (const p of prods) {
      const dto: PublicProduct = {
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        basePrice: p.basePrice,
        glbUrl: asset(p.glbUrl),
        fallbackImageUrl: asset(p.fallbackImageUrl),
        rackPosition: p.rackPosition,
        transform: p.transformConfig,
        procedural: p.proceduralConfig,
        sizeGuide: p.sizeGuide,
        variants: vars
          .filter((v) => v.productId === p.id)
          .map((v) => ({ id: v.id, sku: v.sku, colorName: v.colorName, colorHex: v.colorHex, pbr: v.pbrConfig, size: v.size, inStock: v.stock > 0, priceDelta: v.priceDelta })),
        hotspots: spots
          .filter((h) => h.productId === p.id)
          .map((h) => ({ id: h.id, label: h.label, description: h.description, position: h.position3d, cameraOffset: h.cameraOffset })),
      };
      const list = byCollection.get(p.collectionId!) ?? [];
      list.push(dto);
      byCollection.set(p.collectionId!, list);
    }
  }

  return cols.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    isDefault: c.isDefault,
    preset: (c.environmentPreset && presets.get(c.environmentPreset)) || fallbackPreset,
    products: byCollection.get(c.id) ?? [],
  }));
}

export async function getStorefrontData(): Promise<StorefrontData | null> {
  const settings = await getPublicSettings();
  if (!settings) return null;
  return { settings, racks: await getPublicRacks({ withProducts: true }) };
}
