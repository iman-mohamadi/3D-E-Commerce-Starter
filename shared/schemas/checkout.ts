import { z } from "zod";
import { address } from "./json";
import { MAX_LINE_QTY, type CouponProblem } from "../pricing";

export const cartItemInput = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_LINE_QTY),
});

const coupon = z
  .string()
  .trim()
  .max(40)
  .transform((c) => c.toUpperCase())
  .optional();

export const quoteInput = z.object({
  items: z.array(cartItemInput).max(50),
  couponCode: coupon,
});
export type QuoteInput = z.infer<typeof quoteInput>;

/** Delivery methods are derived from store settings (flat rate + free-shipping threshold). */
export const DELIVERY_METHODS = ["standard"] as const;

export const checkoutInput = z.object({
  items: z.array(cartItemInput).min(1, "Your bag is empty").max(50),
  couponCode: coupon,
  email: z.email("Enter a valid email").transform((e) => e.trim().toLowerCase()),
  shippingAddress: address.extend({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    phone: z.string().trim().min(5, "Enter a phone number").max(30),
    line1: z.string().trim().min(3, "Enter your street address").max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1, "Enter your city").max(100),
    region: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().min(2, "Enter a postal code").max(20),
    country: z.string().trim().toUpperCase().length(2, "Use the 2-letter country code"),
  }),
  deliveryMethod: z.enum(DELIVERY_METHODS),
  notes: z.string().trim().max(500).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutInput>;

export const orderLookupInput = z.object({
  orderNumber: z.string().trim().min(5).max(40).toUpperCase(),
  email: z.email().transform((e) => e.trim().toLowerCase()),
});

/* ---- quote response ---- */

export type LineStatus = "ok" | "reduced" | "out_of_stock" | "unavailable";

export interface QuoteLine {
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  sku: string;
  colorName: string;
  colorHex: string;
  size: string;
  image: string | null;
  /** live unit price (base_price + price_delta), minor units */
  unitPrice: number;
  requestedQuantity: number;
  /** quantity actually priced (capped to what is available) */
  quantity: number;
  /** most the shopper can add right now (capped at MAX_LINE_QTY; raw stock is never exposed) */
  maxQuantity: number;
  status: LineStatus;
  lineTotal: number;
}

export interface QuoteCoupon {
  code: string;
  applied: boolean;
  reason?: CouponProblem;
  /** shown when reason === "min_subtotal" */
  minSubtotal?: number;
  discount: number;
}

export interface QuoteResponse {
  currency: string;
  lines: QuoteLine[];
  subtotal: number;
  coupon: QuoteCoupon | null;
  discountTotal: number;
  shipping: { fee: number; isFree: boolean; freeThreshold: number | null; remainingForFree: number | null };
  deliveryMethods: { id: (typeof DELIVERY_METHODS)[number]; fee: number }[];
  total: number;
  /** true when every requested line can be fulfilled as requested */
  canCheckout: boolean;
}
