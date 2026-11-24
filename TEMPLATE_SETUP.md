# Template setup guide

Everything a client store needs (brand, racks, products, lighting, currency, RTL) lives in the database and is edited from `/admin`.
This guide is the short path from `git clone` to a branded store, plus the three things operators ask about most: 3D models, payment gateways and cron.

## 1. Launch a new brand in under 10 minutes

Requirements: Node 20+ (tested on 24) and npm. Docker only for Path B.

### Path A: quick start, no database install (PGlite, ~3 min)

An in-memory Postgres with the demo store pre-seeded. **Data is lost when you stop it**: perfect for a first look or a design review.

```bash
git clone <this-repo> acme-store && cd acme-store
npm install
cp .env.example .env            # then edit: set AUTH_SECRET (see .env.example for the one-liner)
```

In `.env` set:

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/postgres
DATABASE_POOL_MAX=1
DATABASE_FETCH_TYPES=false
```

```bash
npm run dev:db      # terminal 1: prints the admin login (admin@example.com / dev-admin-password)
npm run dev         # terminal 2: http://localhost:3000   (admin: /admin)
```

### Path B: Docker Postgres 16 + MinIO (~8 min, persistent)

```bash
git clone <this-repo> acme-store && cd acme-store
npm install
cp .env.example .env            # set AUTH_SECRET; DATABASE_URL already matches docker-compose.yml
docker compose up -d            # postgres:16, minio, and a one-shot job that creates the bucket
npm run db:migrate && npm run db:seed    # seed prints a generated admin password once
```

For S3-style storage with MinIO, uncomment the MinIO block in `.env` and set `STORAGE_DRIVER=s3`
(the web console is at http://localhost:9001, login `minioadmin` / `minioadmin`; local dev only). Then `npm run dev`.

### Make it the client's brand (both paths)

```bash
npm run init:brand              # interactive: Enter keeps the current value
```

Or non-interactive, for provisioning scripts:

```bash
BRAND_NAME="Rosa Mode" BRAND_LOCALE=fa BRAND_CURRENCY=IRR BRAND_ORDER_PREFIX=ROSA \
BRAND_ACCENT="#e6a0b4" ADMIN_ROTATE=true ADMIN_EMAIL=owner@rosa.example \
npm run init:brand -- --yes
```

| Variable | Effect |
|---|---|
| `BRAND_NAME`, `BRAND_TAGLINE` | store name and tagline |
| `BRAND_LOCALE` (`en`/`fa`), `BRAND_DIRECTION` | UI language; `fa` implies RTL unless overridden |
| `BRAND_CURRENCY`, `BRAND_CURRENCY_DECIMALS` | ISO code; decimals default to 0 for IRR/JPY/KRW and similar, else 2 |
| `BRAND_ORDER_PREFIX` | order numbers look like `ROSA-20260101-AB3XK` |
| `BRAND_PAYMENT_PROVIDER` | id of a registered payment adapter (section 3) |
| `BRAND_ACCENT`, `BRAND_BACKGROUND`, `BRAND_FOREGROUND` | `#RRGGBB` theme colours |
| `ADMIN_ROTATE=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | change the seeded admin; blank password = generated and printed once |

Then open **/admin → Studio Settings** for logo, free-shipping threshold and lighting presets, **Racks** for collections,
**Products** to upload `.glb` models, set variants and place hotspots. Before going live: rotate the seeded admin, set a real
`AUTH_SECRET`, and run `npm run verify:checkout` once.

Production checklist: HTTPS, `RATE_LIMIT_TRUST_PROXY` matches your proxy setup (it must overwrite `X-Forwarded-For`; set `false` if the app is exposed directly),
`DATABASE_POOL_MAX` x instances below Postgres `max_connections`, and a cron for order expiry (section 4).

## 2. Preparing and optimising `.glb` garments

The storefront loads GLB with Draco support (decoder served from `/draco`, copied on `npm install`). Procedural garments are used automatically
until a model is uploaded or if it fails to load, so you can launch before the 3D assets are ready.

**Targets (mobile-friendly):**

| Item | Target |
|---|---|
| Triangles | 30k to 60k per garment (hard ceiling around 100k) |
| Textures | at most 2048 px (1024 px for secondary maps); PNG/JPG/WebP |
| File size | under 8 MB after compression (upload limit is 80 MB) |
| Materials | one per fabric region; no embedded lights or cameras |
| Units | metres; upright; front facing +Z |

**Compress with gltf-transform** (no install needed):

```bash
npx @gltf-transform/cli optimize coat.glb coat.opt.glb --compress draco --texture-compress webp --texture-size 2048
```

Use WebP or JPG textures. KTX2 textures are not wired into the loader.

**Alignment convention (important):** the engine anchors every model for you: after loading, it moves the **top of the bounding box to y = 0 (the shoulder line / waistband),
centres it on x and z**, and hangs it from the standard hanger. So you only need an upright, front-facing, metre-scaled export. Then fine-tune in the admin:
`scale`, `offsetY`, `rotationY` (the live 3D Studio applies them instantly).

**Hotspots** are stored in this garment-local space: **origin at the shoulder line, y pointing down** (a chest point is roughly y = -0.25), so they keep working
when you change scale or rotation. Place them by clicking the model in the admin studio: the position and camera angle are captured for you.

**Variants and colours:** each variant's `pbr_config.meshTarget` selects what gets tinted. The default `body` matches any mesh or material named `body`, `body_*` or `body.*`.
Name fabric meshes `body_*` in your DCC tool and leave trims (buttons, zips, labels) with other names. If nothing matches, the colour is applied to the whole model so previews never break.

Always add a **fallback image** (shown when WebGL is unavailable).

## 3. Registering a payment gateway

A gateway is one class implementing `PaymentAdapter` (`server/adapters/payment/types.ts`):

```ts
interface PaymentAdapter {
  id: string;
  createPayment(input): Promise<{ reference: string; redirectUrl?: string; status: "paid" | "pending" | "failed" }>;
  verifyPayment(input): Promise<{ status: "paid" | "pending" | "failed"; transactionId?: string }>;
  refund?(input): Promise<{ ok: boolean }>;
}
```

**Flow the template already handles:** checkout creates a `pending` order (stock reserved), calls `createPayment`, stores your `reference`, and sends the customer to `redirectUrl`.
The gateway must send them back to `input.returnUrl` (an absolute URL ending in `?order=<number>`; append your own query params). The return endpoint then calls
`verifyPayment({ reference, params, expectedAmount })`: **verify with the provider server-side, never trust the query string**, and compare the amount.
`paid` marks the order paid; `failed` cancels it and releases stock.

**1. Write the adapter** (example skeleton for Zarinpal, check the provider's current API docs before shipping):

```ts
// server/adapters/payment/zarinpal.ts
import type { PaymentAdapter } from "./types";

export class ZarinpalAdapter implements PaymentAdapter {
  readonly id = "zarinpal";
  constructor(private merchantId: string, private base = "https://payment.zarinpal.com") {}

  async createPayment(i) {
    const res = await fetch(`${this.base}/pg/v4/payment/request.json`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ merchant_id: this.merchantId, amount: i.amount, callback_url: i.returnUrl, description: `Order ${i.orderNumber}`, metadata: { email: i.customerEmail } }),
    }).then((r) => r.json());
    const authority = res?.data?.authority;
    if (!authority) throw new Error("Zarinpal request failed"); // the template cancels the order and releases stock
    return { reference: authority, status: "pending" as const, redirectUrl: `${this.base}/pg/StartPay/${authority}` };
  }

  async verifyPayment(i) {
    if (i.params.Status !== "OK") return { status: "failed" as const };
    const res = await fetch(`${this.base}/pg/v4/payment/verify.json`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ merchant_id: this.merchantId, amount: i.expectedAmount, authority: i.reference }),
    }).then((r) => r.json());
    const code = res?.data?.code; // 100 = verified, 101 = already verified
    return code === 100 || code === 101 ? { status: "paid" as const, transactionId: String(res.data.ref_id) } : { status: "failed" as const };
  }
}
```

For **Stripe Checkout**: `createPayment` creates a Checkout Session with `success_url = returnUrl + "&session_id={CHECKOUT_SESSION_ID}"` and
`cancel_url = returnUrl + "&cancelled=1"`, returns `reference: session.id` and `redirectUrl: session.url`; `verifyPayment` retrieves the session and returns
`paid` when `payment_status === "paid"`. Amounts are already integer minor units, which is what both Stripe and Zarinpal expect.

**2. Register it** (anywhere that runs at server start, e.g. the bottom of `server/adapters/payment/index.ts`):

```ts
import { ZarinpalAdapter } from "./zarinpal";
registerPaymentProvider("zarinpal", () => new ZarinpalAdapter(process.env.ZARINPAL_MERCHANT_ID!));
```

**3. Activate it:** `BRAND_PAYMENT_PROVIDER=zarinpal npm run init:brand -- --yes`
(or `update store_settings set payment_provider = 'zarinpal'`). Add provider secrets to your environment.

**Production notes:** customers sometimes close the tab before returning. Add a provider webhook route that calls the same `finalizePayment()`
(idempotent, safe to call twice). Keep `ORDER_EXPIRY_MINUTES` **longer than the gateway session lifetime** so a late successful payment is never cancelled underneath the customer.
The built-in `mock` gateway has an approve/decline page for testing and should not be the active provider in production.

## 4. Pending-order expiry (cron)

Unpaid `pending` orders hold stock and coupon uses. `expirePendingOrders()` cancels those older than `ORDER_EXPIRY_MINUTES` (default 30) and releases both atomically.
It only ever touches `pending` orders, so a just-paid order is never cancelled, and it is safe to run repeatedly or concurrently. Run it every 5 to 15 minutes by any of:

**CLI** (cron on the host, Docker sidecar, CI scheduler):

```bash
npm run orders:expire              # uses ORDER_EXPIRY_MINUTES
npm run orders:expire -- --ttl 45  # one-off override
# crontab:  */10 * * * *  cd /srv/acme-store && /usr/bin/npm run orders:expire >> /var/log/orders-expire.log 2>&1
```

**HTTP endpoint** (set `CRON_SECRET`, 16+ random chars; unset means the endpoint is disabled):

```bash
curl -fsS -X POST https://shop.example.com/api/internal/orders/expire -H "Authorization: Bearer $CRON_SECRET"
# -> {"expired":2,"numbers":["ROSA-20260101-AB3XK","..."],"ttlMinutes":30}
```

**Vercel Cron** (sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set; the endpoint also answers `GET`):

```json
{ "crons": [{ "path": "/api/internal/orders/expire", "schedule": "*/10 * * * *" }] }
```

**Docker sidecar** (add to your compose file):

```yaml
  expire-orders:
    image: curlimages/curl:latest
    restart: unless-stopped
    entrypoint: /bin/sh -c 'while true; do curl -fsS -X POST http://app:3000/api/internal/orders/expire -H "Authorization: Bearer $$CRON_SECRET"; sleep 600; done'
    environment: { CRON_SECRET: "${CRON_SECRET}" }
```

## 5. Operations reference

- **Rate limiting** (`server/security/policies.ts`): login, register and guest order lookup return `429` with `Retry-After`. The default limiter is in process memory;
  with several instances behind a load balancer, implement the 3-method `RateLimiter` interface in `server/security/rate-limit.ts` against Redis
  (atomic sliding window, e.g. a sorted set per key in a Lua script) and call `setRateLimiter(...)` once at startup.
- **Verification:** `npm run verify:checkout` runs pricing, checkout, overselling, cancellation, payment, expiry, rate-limit and brand-bootstrap checks against an in-memory Postgres.
- **Environment:** every variable is documented in `.env.example`.
