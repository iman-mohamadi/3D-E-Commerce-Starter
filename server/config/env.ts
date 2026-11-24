import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_SESSION_DAYS: z.coerce.number().int().positive().default(7),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".uploads"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool.default(false),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  PAYMENT_PROVIDER: z.string().default("mock"),

  /** unpaid pending orders older than this are cancelled by the expiry sweeper */
  ORDER_EXPIRY_MINUTES: z.coerce.number().int().min(5).max(7 * 24 * 60).default(30),
  /** shared secret for POST /api/internal/orders/expire (unset = endpoint disabled) */
  CRON_SECRET: z.string().min(16).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  /** read client IPs from X-Forwarded-For / X-Real-IP for rate limiting (set false when not behind a proxy) */
  RATE_LIMIT_TRUST_PROXY: bool.default(true),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Lazily validated so `next build` and edge code that never calls it don't need every var. */
export function env(): Env {
  if (cached) return cached;
  // Treat empty strings (from .env.example copies) as unset.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}
