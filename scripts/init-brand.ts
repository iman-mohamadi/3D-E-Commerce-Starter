/**
 * npm run init:brand                 interactive (Enter keeps the current value)
 * npm run init:brand -- --yes        env-driven / non-interactive (CI, Docker, provisioning scripts)
 *
 * Env: BRAND_NAME BRAND_TAGLINE BRAND_LOCALE(en|fa) BRAND_DIRECTION(ltr|rtl) BRAND_CURRENCY BRAND_CURRENCY_DECIMALS
 *      BRAND_ORDER_PREFIX BRAND_PAYMENT_PROVIDER BRAND_ACCENT BRAND_BACKGROUND BRAND_FOREGROUND (#RRGGBB)
 *      ADMIN_ROTATE=true  ADMIN_EMAIL  ADMIN_PASSWORD (blank = generate and print once)
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { pgOptions } from "../db/options";
import { applyBrand, type BrandInput } from "../server/services/brand";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (copy .env.example to .env).");
  process.exit(1);
}
const client = postgres(process.env.DATABASE_URL, { ...pgOptions(), max: Number(process.env.DATABASE_POOL_MAX ?? 1) });
const db = drizzle(client, { schema });

const E = process.env;
const num = (v: string | undefined) => (v === undefined || v === "" ? undefined : Number(v));
const flag = (v: string | undefined) => v === "true" || v === "1";

async function main() {
  const [cur] = await db.select().from(schema.storeSettings).where(eq(schema.storeSettings.id, 1));
  if (!cur) throw new Error("store_settings is empty. Run `npm run db:migrate && npm run db:seed` first.");
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).limit(1);

  const nonInteractive = process.argv.includes("--yes") || !process.stdin.isTTY;
  let input: BrandInput;

  if (nonInteractive) {
    input = {
      brandName: E.BRAND_NAME || undefined,
      tagline: E.BRAND_TAGLINE === undefined ? undefined : E.BRAND_TAGLINE,
      locale: (E.BRAND_LOCALE as "en" | "fa") || undefined,
      direction: (E.BRAND_DIRECTION as "ltr" | "rtl") || undefined,
      currency: E.BRAND_CURRENCY || undefined,
      currencyDecimals: num(E.BRAND_CURRENCY_DECIMALS),
      orderPrefix: E.BRAND_ORDER_PREFIX || undefined,
      paymentProvider: E.BRAND_PAYMENT_PROVIDER || undefined,
      accent: E.BRAND_ACCENT || undefined,
      background: E.BRAND_BACKGROUND || undefined,
      foreground: E.BRAND_FOREGROUND || undefined,
      admin: flag(E.ADMIN_ROTATE) || E.ADMIN_EMAIL || E.ADMIN_PASSWORD ? { email: E.ADMIN_EMAIL || undefined, password: E.ADMIN_PASSWORD || undefined } : undefined,
    };
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (label: string, def: string | number | null | undefined) => {
      const a = (await rl.question(`${label}${def !== undefined && def !== null && def !== "" ? ` [${def}]` : ""}: `)).trim();
      return a === "" ? undefined : a;
    };
    console.log("White-label brand bootstrap. Press Enter to keep the current value.\n");
    const locale = (await ask("Language (en/fa)", cur.defaultLocale)) as "en" | "fa" | undefined;
    const brandName = await ask("Brand name", cur.brandName);
    const tagline = await ask("Tagline", cur.tagline);
    const currency = await ask("Currency (ISO code)", cur.currency);
    const prefix = await ask("Order number prefix", cur.orderNumberPrefix);
    const paymentProvider = await ask("Payment provider id", cur.paymentProvider);
    const accent = await ask("Accent colour (#RRGGBB)", cur.brandTheme.accent);
    const background = await ask("Background colour (#RRGGBB)", cur.brandTheme.background);
    const foreground = await ask("Foreground colour (#RRGGBB)", cur.brandTheme.foreground);
    const rotate = ((await rl.question(`Rotate admin credentials${admin ? ` (${admin.email})` : ""}? (y/N): `)).trim().toLowerCase() === "y");
    let adminInput: BrandInput["admin"];
    if (rotate) {
      const email = await ask("Admin email", admin?.email);
      const password = await ask("New admin password (blank = generate)", undefined);
      adminInput = { email, password };
    }
    rl.close();
    input = { brandName, tagline, locale, currency, orderPrefix: prefix, paymentProvider, accent, background, foreground, admin: adminInput };
  }

  const res = await applyBrand(db, input, { generatePassword: () => randomBytes(12).toString("base64url") });
  console.log(res.settingsUpdated.length ? `Updated store settings: ${res.settingsUpdated.join(", ")}` : "No store settings changed.");
  if (res.admin) {
    console.log(`Admin ${res.admin.created ? "created" : "updated"}: ${res.admin.email}`);
    if (res.admin.password) console.log(`Generated admin password (shown once): ${res.admin.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
