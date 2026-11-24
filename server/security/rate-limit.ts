import { createHash } from "node:crypto";
import { HttpError } from "../http/errors";

export interface RateLimitResult {
  allowed: boolean;
  /** hits left in the current window (0 when blocked) */
  remaining: number;
  /** seconds until a blocked caller may try again (0 when allowed) */
  retryAfterSeconds: number;
}

/**
 * Pluggable limiter contract. The default is in-process (fine for one instance / dev). For several instances
 * behind a load balancer, implement this against Redis (sliding-window sorted set) and register it once at startup:
 *
 *   import { setRateLimiter } from "@/server/security/rate-limit";
 *   setRateLimiter(new MyRedisRateLimiter(redisClient));
 *
 * `hit` must be atomic per key and only count the attempt when it is allowed.
 */
export interface RateLimiter {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export interface MemoryLimiterOptions {
  /** injectable clock for tests */
  now?: () => number;
  /** hard cap on tracked keys so a flood of unique keys can't exhaust memory */
  maxKeys?: number;
}

/** Sliding-window log limiter held in process memory. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly now: () => number;
  private readonly maxKeys: number;
  private sweeper?: ReturnType<typeof setInterval>;
  private longestWindow = 0;

  constructor(opts: MemoryLimiterOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.maxKeys = opts.maxKeys ?? 50_000;
    if (!opts.now) {
      this.sweeper = setInterval(() => this.sweep(), 60_000);
      this.sweeper.unref?.(); // never keep the process alive
    }
  }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const t = this.now();
    this.longestWindow = Math.max(this.longestWindow, windowMs);
    const log = (this.hits.get(key) ?? []).filter((x) => x > t - windowMs);
    if (log.length >= limit) {
      this.hits.set(key, log);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((log[0]! + windowMs - t) / 1000)) };
    }
    log.push(t);
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) this.sweep(true);
    this.hits.set(key, log);
    return { allowed: true, remaining: limit - log.length, retryAfterSeconds: 0 };
  }

  async reset(key: string) {
    this.hits.delete(key);
  }

  private sweep(force = false) {
    const cutoff = this.now() - this.longestWindow;
    for (const [k, log] of this.hits) if (log.length === 0 || log[log.length - 1]! <= cutoff) this.hits.delete(k);
    if (force && this.hits.size >= this.maxKeys) this.hits.delete(this.hits.keys().next().value as string); // evict oldest
  }

  dispose() {
    if (this.sweeper) clearInterval(this.sweeper);
  }
}

const g = globalThis as unknown as { __rateLimiter?: RateLimiter };

export function rateLimiter(): RateLimiter {
  return (g.__rateLimiter ??= new MemoryRateLimiter());
}

/** Replace the default in-memory limiter (e.g. with a Redis-backed one). */
export function setRateLimiter(l: RateLimiter) {
  g.__rateLimiter = l;
}

export interface Rule {
  name: string;
  limit: number;
  windowMs: number;
}

/** Best-effort client address. Requires the app to sit behind a proxy that sets/overwrites these headers (see TEMPLATE_SETUP.md). */
export function clientIp(req: Request): string {
  if (process.env.RATE_LIMIT_TRUST_PROXY === "false") return "direct";
  const h = req.headers;
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown";
}

const digest = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 24);

/**
 * Applies `rule` to `subject` (an IP, or ip + identifier). Throws HttpError 429 with a Retry-After header when exceeded.
 * Identifiers (emails, order numbers) are hashed so they never sit in limiter storage in clear text.
 */
export async function enforceRateLimit(rule: Rule, subject: string, limiter: RateLimiter = rateLimiter()) {
  const res = await limiter.hit(`${rule.name}:${digest(subject)}`, rule.limit, rule.windowMs);
  if (!res.allowed) {
    throw new HttpError(429, "Too many attempts. Please wait a moment and try again.", { retryAfterSeconds: res.retryAfterSeconds }, { "Retry-After": String(res.retryAfterSeconds) });
  }
  return res;
}

export async function resetRateLimit(rule: Rule, subject: string, limiter: RateLimiter = rateLimiter()) {
  await limiter.reset(`${rule.name}:${digest(subject)}`);
}
