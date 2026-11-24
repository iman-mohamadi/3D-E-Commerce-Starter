import { check, integer, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, timestamps } from "./_common";
import type { BrandTheme, LightingConfig, StudioPresetConfig } from "../../shared/schemas/json";

export const textDirection = pgEnum("text_direction", ["ltr", "rtl"]);
export const locale = pgEnum("locale", ["en", "fa"]);

/**
 * Studio presets: named lighting + rack + camera rigs, fully editable in the
 * 3D Studio CMS. Collections reference one via `environment_preset`; the store
 * references one as its default theme via `studio_theme_preset`.
 */
export const studioPresets = pgTable(
  "studio_presets",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    config: jsonb("config").$type<StudioPresetConfig>().notNull(),
    ...timestamps,
  },
);

/** Singleton row (id = 1). All brand identity lives here — nothing hardcoded in the UI. */
export const storeSettings = pgTable(
  "store_settings",
  {
    id: integer("id").primaryKey().default(1),
    brandName: text("brand_name").notNull(),
    tagline: text("tagline"),
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    brandTheme: jsonb("brand_theme").$type<BrandTheme>().notNull(),
    /** ISO 4217, e.g. "USD", "IRR". */
    currency: text("currency").notNull().default("USD"),
    /** Decimals of the currency's minor unit (USD=2, IRR/JPY=0). All money columns are integer minor units. */
    currencyDecimals: integer("currency_decimals").notNull().default(2),
    defaultLocale: locale("default_locale").notNull().default("en"),
    direction: textDirection("direction").notNull().default("ltr"),
    /** studio_presets.slug */
    studioThemePreset: text("studio_theme_preset")
      .notNull()
      .references(() => studioPresets.slug, { onUpdate: "cascade", onDelete: "restrict" }),
    /** Partial override merged over the preset's lighting. */
    lightingConfig: jsonb("lighting_config").$type<Partial<LightingConfig>>().notNull().default({}),
    /** Minor units; null = free shipping disabled. */
    freeShippingThreshold: integer("free_shipping_threshold"),
    flatShippingRate: integer("flat_shipping_rate").notNull().default(0),
    paymentProvider: text("payment_provider").notNull().default("mock"),
    /** Prefix for human-readable order numbers: PREFIX-YYYYMMDD-XXXXX */
    orderNumberPrefix: text("order_number_prefix").notNull().default("ORD"),
    ...timestamps,
  },
  (t) => [check("store_settings_singleton", sql`${t.id} = 1`)],
);

export type StoreSettings = typeof storeSettings.$inferSelect;
export type StudioPreset = typeof studioPresets.$inferSelect;
