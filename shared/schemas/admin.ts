/** Zod payloads for every /api/admin/** route (also reused by admin forms). */
import { z } from "zod";
import { hexColor, pbrConfig, proceduralConfig, sizeGuide, studioPresetConfig, transformConfig, vec3 } from "./json";

export const slug = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

const minor = z.number().int().min(0).max(2_000_000_000);
const nullableUrl = z.string().trim().min(1).max(1000).nullable();

export const productInput = z.object({
  title: z.string().trim().min(1).max(160),
  slug,
  description: z.string().max(10_000).default(""),
  basePrice: minor,
  glbUrl: nullableUrl,
  fallbackImageUrl: nullableUrl,
  collectionId: z.uuid().nullable(),
  rackPosition: z.number().int().min(0).optional(),
  transformConfig,
  proceduralConfig: proceduralConfig.nullable(),
  sizeGuide: sizeGuide.nullable(),
  isActive: z.boolean(),
});
export type ProductInput = z.infer<typeof productInput>;

export const variantInput = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().min(1).max(64),
  colorName: z.string().trim().min(1).max(64),
  colorHex: hexColor,
  pbrConfig,
  size: z.string().trim().min(1).max(16),
  stock: z.number().int().min(0).max(1_000_000),
  priceDelta: z.number().int().min(-2_000_000_000).max(2_000_000_000),
});
export type VariantInput = z.infer<typeof variantInput>;
export const variantsSync = z.object({ variants: z.array(variantInput).max(500) });

export const hotspotInput = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(80),
  description: z.string().max(1000).default(""),
  position3d: vec3,
  cameraOffset: vec3,
});
export type HotspotInput = z.infer<typeof hotspotInput>;
export const hotspotsSync = z.object({ hotspots: z.array(hotspotInput).max(50) });

export const collectionInput = z.object({
  title: z.string().trim().min(1).max(120),
  slug,
  description: z.string().max(2000).nullable().default(null),
  environmentPreset: z.string().nullable(),
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0).default(0),
});
export type CollectionInput = z.infer<typeof collectionInput>;
export const reorderInput = z.object({ productIds: z.array(z.uuid()).max(500) });

const isoDate = z
  .string()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

export const couponInput = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/)
      .transform((c) => c.toUpperCase()),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1),
    minSubtotal: minor,
    maxUses: z.number().int().min(1).nullable(),
    startsAt: isoDate,
    expiresAt: isoDate,
    isActive: z.boolean(),
  })
  .refine((c) => c.type !== "percent" || c.value <= 100, { path: ["value"], message: "Percent must be 1-100" });
export type CouponInput = z.input<typeof couponInput>;

export const orderStatusValues = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof orderStatusValues)[number];

/** Allowed admin-driven transitions. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const orderUpdate = z.object({
  status: z.enum(orderStatusValues).optional(),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
});

export const settingsInput = z.object({
  brandName: z.string().trim().min(1).max(80),
  tagline: z.string().max(200).nullable(),
  logoUrl: nullableUrl,
  faviconUrl: nullableUrl,
  currency: z.string().trim().toUpperCase().min(2).max(8),
  currencyDecimals: z.number().int().min(0).max(4),
  defaultLocale: z.enum(["en", "fa"]),
  direction: z.enum(["ltr", "rtl"]),
  freeShippingThreshold: minor.nullable(),
  flatShippingRate: minor,
  studioThemePreset: z.string().min(1),
  orderNumberPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "2-8 letters or digits"),
});
export type SettingsInput = z.infer<typeof settingsInput>;

export const presetInput = z.object({
  slug,
  name: z.string().trim().min(1).max(80),
  config: studioPresetConfig,
});
export type PresetInput = z.infer<typeof presetInput>;

export const uploadKind = z.enum(["model", "texture", "environment", "image", "brand"]);
export const uploadSignInput = z.object({
  kind: uploadKind,
  filename: z.string().min(1).max(200),
  size: z.number().int().positive(),
});
