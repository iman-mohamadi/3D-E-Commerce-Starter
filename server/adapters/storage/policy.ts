import { randomUUID } from "node:crypto";
import path from "node:path";

export type AssetKind = "model" | "texture" | "environment" | "image" | "brand";

interface Rule {
  prefix: string;
  extensions: Record<string, string>; // ext -> content type
  maxBytes: number;
}

const MB = 1024 * 1024;

/** Allowed uploads per asset kind. Admin upload endpoints must go through `prepareUpload`. */
export const ASSET_RULES: Record<AssetKind, Rule> = {
  model: { prefix: "models", extensions: { ".glb": "model/gltf-binary" }, maxBytes: 80 * MB },
  texture: {
    prefix: "textures",
    extensions: { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ktx2": "image/ktx2" },
    maxBytes: 20 * MB,
  },
  environment: { prefix: "environments", extensions: { ".hdr": "image/vnd.radiance", ".exr": "image/aces", ".ktx2": "image/ktx2" }, maxBytes: 40 * MB },
  image: {
    prefix: "images",
    extensions: { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif" },
    maxBytes: 10 * MB,
  },
  brand: {
    prefix: "brand",
    extensions: { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" },
    maxBytes: 5 * MB,
  },
};

export class UploadRejected extends Error {}

/** Validates name/size and returns a collision-free storage key + content type. */
export function prepareUpload(kind: AssetKind, filename: string, size: number) {
  const rule = ASSET_RULES[kind];
  const ext = path.extname(filename).toLowerCase();
  const contentType = rule.extensions[ext];
  if (!contentType) throw new UploadRejected(`"${ext || filename}" is not allowed for ${kind} uploads`);
  if (size <= 0 || size > rule.maxBytes) throw new UploadRejected(`${kind} uploads must be 1 byte – ${rule.maxBytes / MB} MB`);

  const base = path
    .parse(filename).name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "file";
  const d = new Date();
  const key = `${rule.prefix}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}-${base}${ext}`;
  return { key, contentType };
}

const ALL_TYPES: Record<string, string> = Object.assign({}, ...Object.values(ASSET_RULES).map((r) => r.extensions));

export function contentTypeFor(key: string): string {
  return ALL_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

/** Rejects traversal and odd characters in keys that reach the adapter. */
export function assertSafeKey(key: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return key;
}
