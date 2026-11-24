export interface PutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface SignedUpload {
  /** PUT this URL with `headers` and the raw file body. */
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  key: string;
  /** Public URL the object will have once uploaded. */
  publicUrl: string;
}

/**
 * Storage contract for `.glb` models, textures, HDRIs and brand assets.
 * Callers deal in opaque *keys* ("models/2026/11/<uuid>-coat.glb"); only
 * `publicUrl()` knows where they actually live. DB columns should store the key.
 */
export interface StorageAdapter {
  readonly driver: "local" | "s3";
  put(key: string, body: Uint8Array | ArrayBuffer, opts?: PutOptions): Promise<StoredObject>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string; size: number } | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  publicUrl(key: string): string;
  /** Direct-to-bucket upload for large GLBs. Null if the driver can't (local). */
  signedUpload(key: string, opts: { contentType: string; expiresInSeconds?: number }): Promise<SignedUpload | null>;
}
