import type { PbrConfig, ProceduralConfig, SizeGuide, TransformConfig, Vec3 } from "@/shared/schemas/json";

export interface ProductDraft {
  title: string;
  slug: string;
  description: string;
  basePrice: number;
  glbUrl: string | null;
  fallbackImageUrl: string | null;
  collectionId: string | null;
  transformConfig: TransformConfig;
  proceduralConfig: ProceduralConfig | null;
  sizeGuide: SizeGuide | null;
  isActive: boolean;
}

export interface VariantDraft {
  /** client-side key; server id once saved */
  key: string;
  id?: string;
  sku: string;
  colorName: string;
  colorHex: string;
  pbrConfig: PbrConfig;
  size: string;
  stock: number;
  priceDelta: number;
}

export interface HotspotDraft {
  key: string;
  id?: string;
  label: string;
  description: string;
  position3d: Vec3;
  cameraOffset: Vec3;
}

export interface PresetOption {
  slug: string;
  name: string;
  config: import("@/shared/schemas/json").StudioPresetConfig;
}

export interface CollectionOption {
  id: string;
  title: string;
  environmentPreset: string | null;
}
