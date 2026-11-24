import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, timestamps } from "./_common";
import { studioPresets } from "./settings";
import type { PbrConfig, ProceduralConfig, SizeGuide, TransformConfig, Vec3 } from "../../shared/schemas/json";

/** A "rack" in the 3D studio. */
export const collections = pgTable(
  "collections",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    /** studio_presets.slug — lighting/rack/camera rig used when this rack is shown. */
    environmentPreset: text("environment_preset").references(() => studioPresets.slug, {
      onUpdate: "cascade",
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("collections_slug_uq").on(t.slug),
    // At most one default rack.
    uniqueIndex("collections_single_default_uq").on(t.isDefault).where(sql`${t.isDefault} = true`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    /** Integer minor units (see store_settings.currency_decimals). */
    basePrice: integer("base_price").notNull(),
    /** Storage key or absolute URL. Null -> procedural_config is used. */
    glbUrl: text("glb_url"),
    fallbackImageUrl: text("fallback_image_url"),
    collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
    rackPosition: integer("rack_position").notNull().default(0),
    transformConfig: jsonb("transform_config")
      .$type<TransformConfig>()
      .notNull()
      .default({ scale: 1, offsetY: 0, rotationY: 0 }),
    /** Extension to the spec: procedural garment metadata used until a GLB is uploaded. */
    proceduralConfig: jsonb("procedural_config").$type<ProceduralConfig>(),
    sizeGuide: jsonb("size_guide").$type<SizeGuide>(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_collection_rack_idx").on(t.collectionId, t.rackPosition),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    colorName: text("color_name").notNull(),
    colorHex: text("color_hex").notNull(),
    pbrConfig: jsonb("pbr_config")
      .$type<PbrConfig>()
      .notNull()
      .default({ roughness: 0.8, metalness: 0, meshTarget: "body" }),
    size: text("size").notNull(),
    stock: integer("stock").notNull().default(0),
    /** Minor units added to the product's base_price. May be negative. */
    priceDelta: integer("price_delta").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("product_variants_sku_uq").on(t.sku),
    unique("product_variants_option_uq").on(t.productId, t.colorName, t.size),
    index("product_variants_product_idx").on(t.productId),
  ],
);

export const productHotspots = pgTable(
  "product_hotspots",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    /** Position in the garment's local space. */
    position3d: jsonb("position_3d").$type<Vec3>().notNull(),
    /** Camera offset from the hotspot when focusing it. */
    cameraOffset: jsonb("camera_offset").$type<Vec3>().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_hotspots_product_idx").on(t.productId)],
);

export type Collection = typeof collections.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ProductHotspot = typeof productHotspots.$inferSelect;
