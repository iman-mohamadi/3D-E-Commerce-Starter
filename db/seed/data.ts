/**
 * Sample content for the default "Dark Atelier" rack. This is DATA, not code paths:
 * the app never imports it — only `db/seed.ts` does. Everything here is editable
 * afterwards from the Admin Panel / 3D Studio CMS.
 */
import {
  brandTheme,
  pbrConfig,
  proceduralConfig,
  sizeGuide,
  studioPresetConfig,
  transformConfig,
  vec3,
  type BrandTheme,
  type PbrConfig,
  type ProceduralConfig,
  type SizeGuide,
  type StudioPresetConfig,
  type TransformConfig,
  type Vec3,
} from "../../shared/schemas/json";

export const DARK_ATELIER_PRESET: { slug: string; name: string; config: StudioPresetConfig } = {
  slug: "dark-atelier",
  name: "Dark Atelier",
  config: studioPresetConfig.parse({
    lighting: {
      background: "#0b0b0d",
      fog: { color: "#0b0b0d", near: 6, far: 18 },
      toneMappingExposure: 1.05,
      environmentMap: null,
      environmentIntensity: 0.35,
      ambient: { color: "#8a8fa3", intensity: 0.25 },
      key: { color: "#fff4e6", intensity: 2.4, position: { x: 2.5, y: 4, z: 3 }, castShadow: true },
      // subtle cool fill from the front-right gives fabric a soft specular sheen
      fill: { color: "#a9b6ff", intensity: 0.9, position: { x: 3.2, y: 1.8, z: 2.6 } },
      // back/side lights carve the silhouette of dark garments out of the charcoal backdrop
      rim: { color: "#dfe6ff", intensity: 3.4, position: { x: -2.8, y: 2.8, z: -2.2 } },
      spots: [
        { color: "#ffffff", intensity: 14, position: { x: 0, y: 4.5, z: 1.5 }, angle: 0.5, penumbra: 0.8, target: { x: 0, y: 1, z: 0 }, castShadow: true },
        { color: "#ffd9b0", intensity: 26, position: { x: 2.8, y: 3.4, z: -2 }, angle: 0.65, penumbra: 0.7, target: { x: 0, y: 1.1, z: 0 } },
      ],
      floor: { color: "#111114", roughness: 0.35, metalness: 0.2, reflective: true },
    },
    rack: { type: "line", spacing: 1.25, railHeight: 1.85, railColor: "#2b2b30" },
    camera: { fov: 32, position: { x: 0, y: 1.35, z: 4.4 }, target: { x: 0, y: 1.05, z: 0 } },
  }),
};

export const SEED_SETTINGS: {
  brandName: string;
  tagline: string;
  brandTheme: BrandTheme;
  currency: string;
  currencyDecimals: number;
  defaultLocale: "en" | "fa";
  direction: "ltr" | "rtl";
  freeShippingThreshold: number;
  flatShippingRate: number;
} = {
  brandName: "Atelier Noir",
  tagline: "Garments, lit properly.",
  brandTheme: brandTheme.parse({
    primary: "#f2ece4",
    accent: "#c8a97e",
    background: "#0b0b0d",
    foreground: "#f2ece4",
    muted: "#8b8b93",
    fontDisplay: "Cormorant Garamond",
    fontBody: "Inter",
    radius: "0.125rem",
  }),
  currency: "USD",
  currencyDecimals: 2,
  defaultLocale: "en",
  direction: "ltr",
  freeShippingThreshold: 20000, // $200.00
  flatShippingRate: 1200, // $12.00
};

export const SEED_COLLECTION = {
  title: "The Dark Atelier",
  slug: "dark-atelier",
  description: "Our permanent rack: four foundations in lightless tones.",
  sortOrder: 0,
  isDefault: true,
  environmentPreset: DARK_ATELIER_PRESET.slug,
};

export const SEED_COUPONS = [
  { code: "WELCOME10", type: "percent" as const, value: 10, minSubtotal: 5000, maxUses: null as number | null },
  { code: "ATELIER25", type: "fixed" as const, value: 2500, minSubtotal: 15000, maxUses: 200 },
];

/* ---------------------------------------------------------------------------------------------- */

interface ColorSeed {
  name: string;
  hex: string;
  code: string;
  pbr?: Partial<PbrConfig>;
  priceDelta?: number;
}

export interface ProductSeed {
  title: string;
  slug: string;
  description: string;
  basePrice: number;
  rackPosition: number;
  skuPrefix: string;
  transform: TransformConfig;
  procedural: ProceduralConfig;
  sizeGuide: SizeGuide;
  colors: ColorSeed[];
  sizes: string[];
  stockBySize: Record<string, number>;
  hotspots: { label: string; description: string; position: Vec3; cameraOffset: Vec3 }[];
}

const SIZES = ["S", "M", "L", "XL"];

const topGuide = (rows: [string, number, number, number][]): SizeGuide =>
  sizeGuide.parse({
    unit: "cm",
    columns: ["chest", "length", "sleeve"],
    labels: { chest: "Chest", length: "Length", sleeve: "Sleeve" },
    rows: rows.map(([size, chest, length, sleeve]) => ({ size, measurements: { chest, length, sleeve } })),
    note: "Measurements are garment flat-lay x 2. Model is 185 cm and wears size M.",
  });

export const SEED_PRODUCTS: ProductSeed[] = [
  {
    title: "Boxy Heavyweight Tee",
    slug: "boxy-heavyweight-tee",
    description: "300 gsm combed cotton jersey, dropped shoulder, cut square. Garment-dyed for a lived-in surface.",
    basePrice: 8500,
    rackPosition: 0,
    skuPrefix: "TEE",
    transform: transformConfig.parse({ scale: 1, offsetY: 0, rotationY: 0 }),
    procedural: proceduralConfig.parse({ kind: "tee", params: { width: 0.62, length: 0.74, sleeveLength: 0.24, neck: 0.1, boxiness: 1.15 } }),
    sizeGuide: topGuide([["S", 56, 70, 22], ["M", 58, 72, 23], ["L", 60, 74, 24], ["XL", 62, 76, 25]]),
    colors: [
      { name: "Onyx", hex: "#16161a", code: "ONX", pbr: { roughness: 0.92, metalness: 0 } },
      { name: "Bone", hex: "#e8e0d2", code: "BON", pbr: { roughness: 0.88, metalness: 0 } },
    ],
    sizes: SIZES,
    stockBySize: { S: 12, M: 20, L: 16, XL: 8 },
    hotspots: [
      { label: "300 gsm jersey", description: "Dense combed cotton with a matte, slightly brushed hand.", position: { x: 0.12, y: -0.25, z: 0.15 }, cameraOffset: { x: 0.3, y: 0.1, z: 0.9 } },
      { label: "Ribbed collar", description: "Double-needle 1x1 rib that keeps its shape wash after wash.", position: { x: 0, y: 0.06, z: 0.1 }, cameraOffset: { x: 0, y: 0.15, z: 0.6 } },
    ],
  },
  {
    title: "Fleece Pullover Hoodie",
    slug: "fleece-pullover-hoodie",
    description: "480 gsm loopback fleece with a double-layer hood and hidden kangaroo pocket seams.",
    basePrice: 16500,
    rackPosition: 1,
    skuPrefix: "HOD",
    transform: transformConfig.parse({ scale: 1.02, offsetY: -0.01, rotationY: 0 }),
    procedural: proceduralConfig.parse({ kind: "hoodie", params: { width: 0.66, length: 0.7, sleeveLength: 0.6, hoodHeight: 0.3, boxiness: 1.1 } }),
    sizeGuide: topGuide([["S", 58, 68, 62], ["M", 60, 70, 63], ["L", 62, 72, 64], ["XL", 64, 74, 65]]),
    colors: [
      { name: "Graphite", hex: "#2a2b30", code: "GRP", pbr: { roughness: 0.95, metalness: 0 } },
      { name: "Ash", hex: "#9a9a9f", code: "ASH", pbr: { roughness: 0.93, metalness: 0 } },
      { name: "Oxblood", hex: "#4a1519", code: "OXB", pbr: { roughness: 0.94, metalness: 0 }, priceDelta: 1000 },
    ],
    sizes: SIZES,
    stockBySize: { S: 6, M: 14, L: 10, XL: 4 },
    hotspots: [
      { label: "Double-layer hood", description: "Holds its volume without a drawcord clinging to the chest.", position: { x: 0, y: 0.1, z: -0.06 }, cameraOffset: { x: 0.2, y: 0.2, z: 0.9 } },
      { label: "Loopback fleece", description: "Soft inside, structured outside, pre-shrunk before cutting.", position: { x: -0.18, y: -0.3, z: 0.16 }, cameraOffset: { x: -0.3, y: 0.05, z: 0.8 } },
      { label: "Hidden pocket", description: "Seam-concealed kangaroo pocket for a clean front.", position: { x: 0, y: -0.49, z: 0.18 }, cameraOffset: { x: 0, y: 0.2, z: 0.8 } },
    ],
  },
  {
    title: "Longline Wool Coat",
    slug: "longline-wool-coat",
    description: "Italian wool-cashmere melton, half-canvassed, with a concealed placket and a quiet shawl-cut collar.",
    basePrice: 38000,
    rackPosition: 2,
    skuPrefix: "COA",
    transform: transformConfig.parse({ scale: 1, offsetY: -0.12, rotationY: 0.05 }),
    procedural: proceduralConfig.parse({ kind: "coat", params: { width: 0.68, length: 1.12, sleeveLength: 0.64, lapel: 0.14, boxiness: 1.0 } }),
    sizeGuide: topGuide([["S", 54, 108, 63], ["M", 56, 110, 64], ["L", 58, 112, 65], ["XL", 60, 114, 66]]),
    colors: [
      { name: "Charcoal", hex: "#26272b", code: "CHR", pbr: { roughness: 0.85, metalness: 0 } },
      { name: "Camel", hex: "#a98657", code: "CML", pbr: { roughness: 0.82, metalness: 0 } },
    ],
    sizes: SIZES,
    stockBySize: { S: 3, M: 6, L: 5, XL: 2 },
    hotspots: [
      { label: "Wool-cashmere melton", description: "Felted, wind-resistant, with a soft nap that catches light.", position: { x: 0.2, y: -0.4, z: 0.19 }, cameraOffset: { x: 0.4, y: 0.1, z: 1.0 } },
      { label: "Concealed placket", description: "Horn buttons sit behind the front for an uninterrupted line.", position: { x: 0, y: -0.31, z: 0.19 }, cameraOffset: { x: 0, y: 0.1, z: 0.8 } },
    ],
  },
  {
    title: "Utility Cargo Trousers",
    slug: "utility-cargo-trousers",
    description: "Cotton-nylon ripstop with articulated knees, bellows pockets, and a tapered, relaxed leg.",
    basePrice: 14500,
    rackPosition: 3,
    skuPrefix: "TRS",
    transform: transformConfig.parse({ scale: 1, offsetY: 0.05, rotationY: 0 }),
    procedural: proceduralConfig.parse({ kind: "trousers", params: { waist: 0.38, length: 1.0, legWidth: 0.2, taper: 0.8, pocketDepth: 0.04 } }),
    sizeGuide: sizeGuide.parse({
      unit: "cm",
      columns: ["waist", "inseam", "thigh"],
      labels: { waist: "Waist", inseam: "Inseam", thigh: "Thigh" },
      rows: [
        { size: "S", measurements: { waist: 78, inseam: 78, thigh: 31 } },
        { size: "M", measurements: { waist: 82, inseam: 79, thigh: 32 } },
        { size: "L", measurements: { waist: 86, inseam: 80, thigh: 33 } },
        { size: "XL", measurements: { waist: 90, inseam: 81, thigh: 34 } },
      ],
    }),
    colors: [
      { name: "Obsidian", hex: "#141416", code: "OBS", pbr: { roughness: 0.78, metalness: 0.02 } },
      { name: "Olive", hex: "#4b4d36", code: "OLV", pbr: { roughness: 0.8, metalness: 0.02 } },
    ],
    sizes: SIZES,
    stockBySize: { S: 9, M: 15, L: 12, XL: 5 },
    hotspots: [
      { label: "Bellows pockets", description: "Expandable thigh pockets with snap closures.", position: { x: 0.16, y: -0.42, z: 0.12 }, cameraOffset: { x: 0.4, y: 0.1, z: 0.8 } },
      { label: "Articulated knee", description: "Pre-bent patterning for movement without bagging.", position: { x: 0.1, y: -0.7, z: 0.1 }, cameraOffset: { x: 0.2, y: 0.05, z: 0.7 } },
    ],
  },
];

// Validate shapes once at import so a typo fails the seed loudly rather than corrupting JSON columns.
for (const p of SEED_PRODUCTS) {
  for (const h of p.hotspots) {
    vec3.parse(h.position);
    vec3.parse(h.cameraOffset);
  }
}

export function variantRowsFor(p: ProductSeed) {
  return p.colors.flatMap((c) =>
    p.sizes.map((size) => ({
      sku: `${p.skuPrefix}-${c.code}-${size}`,
      colorName: c.name,
      colorHex: c.hex,
      pbrConfig: pbrConfig.parse({ meshTarget: "body", ...c.pbr }),
      size,
      stock: p.stockBySize[size] ?? 0,
      priceDelta: c.priceDelta ?? 0,
    })),
  );
}
