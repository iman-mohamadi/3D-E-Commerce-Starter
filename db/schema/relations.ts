import { relations } from "drizzle-orm";
import { users } from "./users";
import { storeSettings, studioPresets } from "./settings";
import { collections, productHotspots, productVariants, products } from "./catalog";
import { coupons, orderItems, orders } from "./commerce";

export const studioPresetsRelations = relations(studioPresets, ({ many }) => ({
  collections: many(collections),
}));

export const storeSettingsRelations = relations(storeSettings, ({ one }) => ({
  studioPreset: one(studioPresets, { fields: [storeSettings.studioThemePreset], references: [studioPresets.slug] }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  environment: one(studioPresets, { fields: [collections.environmentPreset], references: [studioPresets.slug] }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  collection: one(collections, { fields: [products.collectionId], references: [collections.id] }),
  variants: many(productVariants),
  hotspots: many(productHotspots),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const productHotspotsRelations = relations(productHotspots, ({ one }) => ({
  product: one(products, { fields: [productHotspots.productId], references: [products.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({ orders: many(orders) }));

export const couponsRelations = relations(coupons, ({ many }) => ({ orders: many(orders) }));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));
