import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertSafeKey, contentTypeFor } from "./policy";
import type { PutOptions, SignedUpload, StorageAdapter, StoredObject } from "./types";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string; // R2 / MinIO / Backblaze
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /** CDN or public bucket domain. Falls back to `<endpoint>/<bucket>`. */
  publicBaseUrl?: string;
}

/** S3-compatible driver (AWS S3, Cloudflare R2, MinIO, ...). */
export class S3StorageAdapter implements StorageAdapter {
  readonly driver = "s3" as const;
  private readonly client: S3Client;

  constructor(private readonly cfg: S3StorageConfig) {
    const clientCfg: S3ClientConfig = {
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    };
    this.client = new S3Client(clientCfg);
  }

  async put(key: string, body: Uint8Array | ArrayBuffer, opts: PutOptions = {}): Promise<StoredObject> {
    const buf = body instanceof Uint8Array ? body : new Uint8Array(body);
    const contentType = opts.contentType ?? contentTypeFor(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: assertSafeKey(key),
        Body: buf,
        ContentType: contentType,
        CacheControl: opts.cacheControl ?? "public, max-age=31536000, immutable",
      }),
    );
    return { key, url: this.publicUrl(key), size: buf.byteLength, contentType };
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: assertSafeKey(key) }));
      const body = await res.Body!.transformToByteArray();
      return { body, contentType: res.ContentType ?? contentTypeFor(key), size: body.byteLength };
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: assertSafeKey(key) }));
  }

  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: assertSafeKey(key) }));
      return true;
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") return false;
      throw e;
    }
  }

  publicUrl(key: string) {
    assertSafeKey(key);
    const base = this.cfg.publicBaseUrl ?? `${this.cfg.endpoint?.replace(/\/$/, "") ?? ""}/${this.cfg.bucket}`;
    return `${base.replace(/\/$/, "")}/${key}`;
  }

  async signedUpload(key: string, opts: { contentType: string; expiresInSeconds?: number }): Promise<SignedUpload> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: assertSafeKey(key), ContentType: opts.contentType }),
      { expiresIn: opts.expiresInSeconds ?? 600 },
    );
    return { url, method: "PUT", headers: { "Content-Type": opts.contentType }, key, publicUrl: this.publicUrl(key) };
  }
}
