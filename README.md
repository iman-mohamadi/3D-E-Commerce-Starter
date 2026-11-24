# Atelier 3D Commerce — white-label template

Next.js (App Router) · TypeScript strict · Drizzle + PostgreSQL · Zod · Three.js/GSAP (Phase 2+).

## Folder structure

```
app/                  Next routing shell only (thin): pages/layouts/route handlers import from the modules below
  api/auth/*          login · register · logout · me
  api/admin/*         admin-only API (guarded twice: proxy.ts + requireAdmin())
  api/files/[...key]  serves the local storage driver
proxy.ts              coarse auth gate (Next 16 successor to middleware.ts)

storefront/           customer UI: rack scene shell, PDP, cart, checkout          (Phase 2)
admin/                admin panel UI + embedded 3D Studio CMS                      (Phase 3-4)
three/                shared engine used by storefront AND admin preview           (Phase 2)
  engine/ loaders/ (GLTF + Draco, KTX2)  garments/ (procedural builders)  rack/  hotspots/  dispose.ts
server/
  adapters/storage    StorageAdapter: local + S3-compatible (R2/MinIO) + upload policy
  adapters/payment    PaymentAdapter registry: mock built in, Stripe/Zarinpal register here
  auth/               scrypt passwords · JWT cookie session · requireUser/requireAdmin
  config/env.ts       zod-validated environment
  http/errors.ts      HttpError, handle(), parseJson()
  services/           catalog / orders / settings use-cases                        (Phase 2+)
db/
  schema/             Drizzle tables + relations
  seed.ts, seed/      idempotent seed (Dark Atelier rack, 4 procedural garments)
  client.ts, migrate.ts
shared/schemas/       Zod schemas for every JSON column (single source of truth, also feeds three/)
drizzle/              generated SQL migrations
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
