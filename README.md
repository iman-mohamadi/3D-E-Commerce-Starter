# Atelier 3D Commerce — white-label template

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
  services/           catalog, admin queries, storefront DTO assembly
  config/env.ts       zod-validated environment
db/                   Drizzle schema, migrations, seed
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

## Conventions

- **Money** is always integer minor units; `store_settings.currency_decimals` says how to display it.
- **Assets** (`glb_url`, logo, textures) store *storage keys*; resolve with `storage().publicUrl(key)`.
- **No hardcoded content**: brand, presets, racks, products, hotspots, and PBR variants all live in the DB. `db/seed/data.ts` is the only place sample content exists.
- **Auth**: `proxy.ts` is a fast filter; always call `requireAdmin()` / `requireUser()` in handlers (they re-read the user row).
