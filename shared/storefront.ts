/**
 * Public, read-only DTOs served to shoppers. Deliberately a subset of the DB rows:
 * no timestamps, no raw stock counts, no payment provider, no admin-only fields.
 */
import type { BrandTheme, LightingConfig, PbrConfig, ProceduralConfig, SizeGuide, StudioPresetConfig, TransformConfig, Vec3 } from "./schemas/json";

export interface PublicSettings {
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandTheme: BrandTheme;
  currency: string;
  currencyDecimals: number;
  defaultLocale: "en" | "fa";
  direction: "ltr" | "rtl";
  studioThemePreset: string;
  lightingOverride: Partial<LightingConfig>;
  freeShippingThreshold: number | null;
  flatShippingRate: number;
}

export interface PublicVariant {
  id: string;
  sku: string;
  colorName: string;
  colorHex: string;
  pbr: PbrConfig;
  size: string;
  inStock: boolean;
  /** minor units added to the product's base price */
  priceDelta: number;
}

export interface PublicHotspot {
  id: string;
  label: string;
  description: string;
  /** garment-local space: origin at the shoulder line / waistband, y points down */
  position: Vec3;
  cameraOffset: Vec3;
}

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  basePrice: number;
  glbUrl: string | null;
  fallbackImageUrl: string | null;
  rackPosition: number;
  transform: TransformConfig;
  procedural: ProceduralConfig | null;
  sizeGuide: SizeGuide | null;
  variants: PublicVariant[];
  hotspots: PublicHotspot[];
}

export interface PublicPreset {
  slug: string;
  name: string;
  config: StudioPresetConfig;
}

export interface PublicRack {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isDefault: boolean;
  /** the rack's own environment preset, else the store theme preset (never null unless no preset exists at all) */
  preset: PublicPreset | null;
  products: PublicProduct[];
}

export interface StorefrontData {
  settings: PublicSettings;
  racks: PublicRack[];
}
