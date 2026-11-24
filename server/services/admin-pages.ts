import { asc } from "drizzle-orm";
import { db } from "../../db/client";
import { collections, studioPresets, storeSettings } from "../../db/schema";
import { transformConfig } from "../../shared/schemas/json";
import type { CollectionOption, HotspotDraft, PresetOption, ProductDraft, VariantDraft } from "../../admin/studio/types";
import { getProductFull } from "./catalog";

/** Everything the ProductEditor needs, shaped as plain serialisable drafts. */
export async function loadEditorData(productId: string | null) {
  const [cols, presets, [settings]] = await Promise.all([
    db.select().from(collections).orderBy(asc(collections.sortOrder)),
    db.select().from(studioPresets).orderBy(asc(studioPresets.name)),
    db.select({ theme: storeSettings.studioThemePreset }).from(storeSettings),
  ]);
  const collectionOptions: CollectionOption[] = cols.map((c) => ({ id: c.id, title: c.title, environmentPreset: c.environmentPreset }));
  const presetOptions: PresetOption[] = presets.map((p) => ({ slug: p.slug, name: p.name, config: p.config }));

  let draft: ProductDraft = {
    title: "",
    slug: "",
    description: "",
    basePrice: 0,
    glbUrl: null,
    fallbackImageUrl: null,
    collectionId: cols.find((c) => c.isDefault)?.id ?? null,
    transformConfig: transformConfig.parse({}),
    proceduralConfig: { kind: "tee", params: {} },
    sizeGuide: null,
    isActive: false,
  };
  let variants: VariantDraft[] = [];
  let hotspots: HotspotDraft[] = [];

  if (productId) {
    const p = await getProductFull(productId);
    if (!p) return null;
    draft = {
      title: p.title,
      slug: p.slug,
      description: p.description,
      basePrice: p.basePrice,
      glbUrl: p.glbUrl,
      fallbackImageUrl: p.fallbackImageUrl,
      collectionId: p.collectionId,
      transformConfig: p.transformConfig,
      proceduralConfig: p.proceduralConfig,
      sizeGuide: p.sizeGuide,
      isActive: p.isActive,
    };
    variants = p.variants.map((v) => ({ key: v.id, id: v.id, sku: v.sku, colorName: v.colorName, colorHex: v.colorHex, pbrConfig: v.pbrConfig, size: v.size, stock: v.stock, priceDelta: v.priceDelta }));
    hotspots = p.hotspots.map((h) => ({ key: h.id, id: h.id, label: h.label, description: h.description, position3d: h.position3d, cameraOffset: h.cameraOffset }));
  }

  return { draft, variants, hotspots, collections: collectionOptions, presets: presetOptions, storeThemePreset: settings?.theme ?? presetOptions[0]?.slug ?? "" };
}
