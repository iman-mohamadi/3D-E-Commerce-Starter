import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { storeSettings, users } from "../../db/schema";
import { hexColor } from "../../shared/schemas/json";
import { paymentProviders } from "../adapters/payment";
import { hashPassword } from "../auth/password";
import type { AnyDb } from "./pricing";

/** Currencies with no minor unit, so `currency_decimals` defaults correctly for new brands. */
const ZERO_DECIMAL = new Set(["IRR", "JPY", "KRW", "VND", "CLP", "ISK", "HUF"]);

export const brandInput = z.object({
  brandName: z.string().trim().min(1).max(80).optional(),
  tagline: z.string().trim().max(200).nullable().optional(),
  locale: z.enum(["en", "fa"]).optional(),
  /** defaults from the locale (fa -> rtl) when omitted */
  direction: z.enum(["ltr", "rtl"]).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter ISO 4217 code").optional(),
  currencyDecimals: z.number().int().min(0).max(4).optional(),
  /** must be registered in server/adapters/payment (built in: mock) */
  paymentProvider: z.string().trim().min(1).max(40).optional(),
  orderPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, "2-8 letters or digits").optional(),
  accent: hexColor.optional(),
  background: hexColor.optional(),
  foreground: hexColor.optional(),
  admin: z
    .object({
      email: z.email().transform((e) => e.trim().toLowerCase()).optional(),
      /** omit email to rotate the password of the existing admin; omit password to have one generated */
      password: z.string().min(10, "Use at least 10 characters").max(200).optional(),
    })
    .optional(),
});
export type BrandInput = z.infer<typeof brandInput>;

export interface BrandResult {
  settingsUpdated: string[];
  admin: { email: string; password?: string; created: boolean } | null;
}

/**
 * Bootstraps a client brand: updates the singleton store_settings row and optionally rotates the
 * seeded admin credentials. Pure service (no IO) so the CLI and tests share it.
 */
export async function applyBrand(exec: AnyDb, raw: BrandInput, opts: { generatePassword?: () => string } = {}): Promise<BrandResult> {
  const input = brandInput.parse(raw);
  const [current] = await exec.select().from(storeSettings).where(eq(storeSettings.id, 1));
  if (!current) throw new Error("store_settings is empty. Run `npm run db:seed` (or db:migrate + seed) first.");

  const set: Partial<typeof storeSettings.$inferInsert> = {};
  if (input.brandName !== undefined) set.brandName = input.brandName;
  if (input.tagline !== undefined) set.tagline = input.tagline || null;
  if (input.locale) {
    set.defaultLocale = input.locale;
    set.direction = input.direction ?? (input.locale === "fa" ? "rtl" : "ltr");
  } else if (input.direction) set.direction = input.direction;
  if (input.currency) {
    set.currency = input.currency;
    set.currencyDecimals = input.currencyDecimals ?? (ZERO_DECIMAL.has(input.currency) ? 0 : 2);
  } else if (input.currencyDecimals !== undefined) set.currencyDecimals = input.currencyDecimals;
  if (input.orderPrefix) set.orderNumberPrefix = input.orderPrefix;
  if (input.paymentProvider) {
    if (!paymentProviders().includes(input.paymentProvider)) {
      throw new Error(`Payment provider "${input.paymentProvider}" is not registered (available: ${paymentProviders().join(", ")}). See TEMPLATE_SETUP.md.`);
    }
    set.paymentProvider = input.paymentProvider;
  }
  if (input.accent || input.background || input.foreground) {
    set.brandTheme = {
      ...current.brandTheme,
      ...(input.accent ? { accent: input.accent } : {}),
      ...(input.background ? { background: input.background } : {}),
      ...(input.foreground ? { foreground: input.foreground, primary: input.foreground } : {}),
    };
  }
  if (Object.keys(set).length) await exec.update(storeSettings).set(set).where(eq(storeSettings.id, 1));

  let admin: BrandResult["admin"] = null;
  if (input.admin) {
    const [existing] = await exec.select().from(users).where(eq(users.role, "admin")).orderBy(users.createdAt).limit(1);
    const password = input.admin.password ?? opts.generatePassword?.();
    if (existing) {
      const patch: Partial<typeof users.$inferInsert> = {};
      if (input.admin.email) patch.email = input.admin.email;
      if (password) patch.passwordHash = await hashPassword(password);
      if (Object.keys(patch).length) await exec.update(users).set(patch).where(eq(users.id, existing.id));
      admin = { email: input.admin.email ?? existing.email, password: input.admin.password ? undefined : password, created: false };
    } else {
      if (!input.admin.email) throw new Error("No admin exists yet: provide admin.email to create one");
      if (!password) throw new Error("Provide a password (or a generator) to create the admin");
      const taken = await exec.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, input.admin.email)).limit(1);
      if (taken.length) throw new Error("That email belongs to an existing non-admin account");
      await exec.insert(users).values({ email: input.admin.email, passwordHash: await hashPassword(password), name: "Store Admin", role: "admin" });
      admin = { email: input.admin.email, password: input.admin.password ? undefined : password, created: true };
    }
  }

  return { settingsUpdated: Object.keys(set), admin };
}
