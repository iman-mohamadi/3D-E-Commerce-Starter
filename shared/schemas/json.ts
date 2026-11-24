/**
 * Zod schemas for every JSON(B) column. They are the single source of truth:
 *  - `db/schema/*` uses `z.infer<>` as the column's `$type`
 *  - API routes / admin forms validate input with them
 *  - `three/` consumes the inferred types
 */
import { z } from "zod";

export const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
export type Vec3 = z.infer<typeof vec3>;

export const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/, "Expected #RRGGBB");

/** products.transform_config — how the garment sits on the rack / in the studio. */
export const transformConfig = z.object({
  scale: z.number().positive().default(1),
  offsetY: z.number().default(0),
  rotationY: z.number().default(0), // radians
});
export type TransformConfig = z.infer<typeof transformConfig>;

/** product_variants.pbr_config — PBR overrides applied to the mesh(es) matching `meshTarget`. */
export const pbrConfig = z.object({
  roughness: z.number().min(0).max(1).default(0.8),
  metalness: z.number().min(0).max(1).default(0),
  /** Name (or glob) of the mesh/material in the GLB, or the procedural part name. */
  meshTarget: z.string().min(1).default("body"),
});
export type PbrConfig = z.infer<typeof pbrConfig>;

/**
 * products.procedural_config — used when `glb_url` is null. Describes a procedural
 * garment the shared three/ engine can build so the storefront works before any
 * real model is uploaded. Parameters are free-form numbers (metres) per `kind`.
 */
export const proceduralConfig = z.object({
  kind: z.enum(["tee", "hoodie", "coat", "trousers", "shirt", "dress", "custom"]),
  params: z.record(z.string(), z.number()).default({}),
});
export type ProceduralConfig = z.infer<typeof proceduralConfig>;

/** products.size_guide */
export const sizeGuide = z.object({
  unit: z.enum(["cm", "in"]).default("cm"),
  /** Column keys, e.g. ["chest", "length", "sleeve"] — labels come from i18n or `labels`. */
  columns: z.array(z.string()).min(1),
  labels: z.record(z.string(), z.string()).optional(),
  rows: z.array(z.object({ size: z.string(), measurements: z.record(z.string(), z.number()) })),
  note: z.string().optional(),
});
export type SizeGuide = z.infer<typeof sizeGuide>;

const light = z.object({
  color: hexColor,
  intensity: z.number().min(0),
  position: vec3.optional(),
  castShadow: z.boolean().optional(),
});

/** Lighting rig — used by studio_presets.config and store_settings.lighting_config (override). */
export const lightingConfig = z.object({
  background: hexColor,
  fog: z.object({ color: hexColor, near: z.number(), far: z.number() }).nullable().default(null),
  toneMappingExposure: z.number().positive().default(1),
  /** Optional HDRI (storage key or URL). Null = no environment map. */
  environmentMap: z.string().nullable().default(null),
  environmentIntensity: z.number().min(0).default(0.4),
  ambient: z.object({ color: hexColor, intensity: z.number().min(0) }),
  key: light,
  fill: light.optional(),
  rim: light.optional(),
  spots: z.array(light.extend({ angle: z.number().optional(), penumbra: z.number().optional(), target: vec3.optional() })).default([]),
  floor: z
    .object({ color: hexColor, roughness: z.number().min(0).max(1), metalness: z.number().min(0).max(1), reflective: z.boolean().default(false) })
    .nullable()
    .default(null),
});
export type LightingConfig = z.infer<typeof lightingConfig>;

/** Rack layout the 3D scene uses for a collection (spacing / curve) — stored on studio preset. */
export const rackLayout = z.object({
  type: z.enum(["line", "arc"]).default("line"),
  spacing: z.number().positive().default(1.2),
  arcRadius: z.number().positive().optional(),
  railHeight: z.number().default(1.8),
  railColor: hexColor.default("#2a2a2a"),
});
export type RackLayout = z.infer<typeof rackLayout>;

/** Studio preset payload (studio_presets.config). */
export const studioPresetConfig = z.object({
  lighting: lightingConfig,
  rack: rackLayout.default({ type: "line", spacing: 1.2, railHeight: 1.8, railColor: "#2a2a2a" }),
  camera: z
    .object({ fov: z.number().default(35), position: vec3, target: vec3 })
    .default({ fov: 35, position: { x: 0, y: 1.4, z: 4.2 }, target: { x: 0, y: 1.1, z: 0 } }),
});
export type StudioPresetConfig = z.infer<typeof studioPresetConfig>;

/** store_settings.brand_theme — CSS-variable-level brand identity. */
export const brandTheme = z.object({
  primary: hexColor,
  accent: hexColor,
  background: hexColor,
  foreground: hexColor,
  muted: hexColor.optional(),
  fontDisplay: z.string().default("Inter"),
  fontBody: z.string().default("Inter"),
  radius: z.string().default("0.25rem"),
});
export type BrandTheme = z.infer<typeof brandTheme>;

export const address = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(3),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  region: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().length(2),
});
export type Address = z.infer<typeof address>;
