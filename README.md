# Atelier 3D Commerce — white-label template

**Operators: start with [TEMPLATE_SETUP.md](TEMPLATE_SETUP.md)** (launch a branded store in under 10 minutes, prepare GLB models, add a payment gateway, set up cron).

Next.js (App Router) · TypeScript strict · Drizzle + PostgreSQL · Zod · Three.js + GSAP.

## Folder structure

```
app/
  (storefront)/       public 3D storefront (own root layout: <html lang/dir> + brand theme from store_settings)
  admin/              admin UI (own root layout) - login + (panel)/ guarded pages
  api/storefront/*    public, cache-friendly read-only API (settings, collections, products)
  api/admin/*         admin API: every route exported via admin() => requireAdmin() + Zod
  api/auth/*          login - register - logout - me
  api/files/[...key]  serves the local storage driver
  api/internal/*      cron-protected ops endpoints (order expiry, CRON_SECRET bearer)
proxy.ts              coarse auth gate (Next 16 successor to middleware.ts)

storefront/           shopper UI: Scene (three/ host), Preloader, HUD, Inspector, size guide, bag preview, i18n (en/fa), cart store
admin/                admin panel UI + embedded 3D product studio (StudioViewport)
three/                shared engine used by storefront AND admin
  engine/             StudioEngine, studio-preset lighting, dispose, default preset
  garments/           procedural builders, hanger, GLB(+Draco) loader
  materials/          variant PBR applier
  stage/GarmentStage  single garment on a hanger (admin studio)
  RackStage.ts        many garments on a rail: inertial navigation, hover sway, inspect/hotspot camera
server/
  adapters/storage    StorageAdapter: local + S3-compatible + upload policy
  adapters/payment    PaymentAdapter registry (mock built in)
  auth/               scrypt passwords - JWT cookie session - requireUser/requireAdmin
  http/               errors, admin() wrapper, publicJson()
  security/           pluggable rate limiter (memory default, Redis interface) + central policies
  services/           catalog, admin queries, storefront DTO assembly
  config/env.ts       zod-validated environment
db/                   Drizzle schema, migrations, seed, connection options
scripts/              dev-db (PGlite), verify-checkout, expire-orders, init-brand, copy-draco
shared/               Zod JSON schemas, money helpers, public storefront DTO types
```

## Getting started

```powershell
Copy-Item .env.example .env      # then set AUTH_SECRET and DATABASE_URL
docker compose up -d db          # or point DATABASE_URL at any Postgres 15+
npm install
npm run db:migrate
npm run db:seed                  # prints a generated admin password if SEED_ADMIN_PASSWORD is empty
npm run dev
```

No Postgres? `npm run dev:db` serves an in-memory, pre-seeded database (admin `admin@example.com` / `dev-admin-password`); run the app with
`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/postgres`, `DATABASE_POOL_MAX=1` and `DATABASE_FETCH_TYPES=false`. Data is lost on exit.

`npm run verify:checkout` runs the money-critical backend checks (pricing, checkout transaction, overselling race, cancellation restore, payment finalisation) against a real in-memory Postgres.

## Checkout flow

1. The cart (`localStorage`) holds only `variantId` + quantity as far as the server is concerned. `POST /api/storefront/cart/quote` re-prices everything from the database (live `base_price + price_delta`, stock, coupon, free-shipping threshold).
2. `POST /api/storefront/checkout` runs one transaction: re-price, conditional stock decrement (`stock >= qty`), coupon usage guard, collision-safe order number (`PREFIX-YYYYMMDD-XXXXX`), order + snapshotted items.
3. Payment starts via the provider in `store_settings.payment_provider` (mock gateway built in); the gateway returns to `GET /api/storefront/payments/return`, which verifies server-side, marks the order paid (or cancels it and restores stock), then redirects to `/checkout/confirm/[orderNumber]`.
4. Confirmation is visible to the signed-in owner or via a guest token / order-number + email lookup. The cart is cleared only when the order is paid.
5. Admin Cancelled and failed payments restore stock and coupon usage exactly once (compare-and-set on the status).

## Conventions

- **Money** is always integer minor units; `store_settings.currency_decimals` says how to display it.
- **Assets** (`glb_url`, logo, textures) store *storage keys*; resolve with `storage().publicUrl(key)`.
- **No hardcoded content**: brand, presets, racks, products, hotspots, and PBR variants all live in the DB. `db/seed/data.ts` is the only place sample content exists.
- **Auth**: `proxy.ts` is a fast filter; always call `requireAdmin()` / `requireUser()` in handlers (they re-read the user row).
