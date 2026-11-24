import { promises as fs } from "node:fs";
import path from "node:path";
import { assertSafeKey, contentTypeFor } from "./policy";
import type { PutOptions, StorageAdapter, StoredObject } from "./types";

/**
 * Filesystem driver for dev / single-node deploys. Files are served by
 * `app/api/files/[...key]/route.ts`.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;
  private readonly root: string;

  constructor(rootDir: string, private readonly publicPrefix = "/api/files") {
    this.root = path.resolve(rootDir);
  }

  private resolve(key: string) {
    const full = path.resolve(this.root, assertSafeKey(key));
    if (!full.startsWith(this.root + path.sep)) throw new Error("Path escapes storage root");
    return full;
  }

  async put(key: string, body: Uint8Array | ArrayBuffer, opts: PutOptions = {}): Promise<StoredObject> {
    const file = this.resolve(key);
    const buf = body instanceof Uint8Array ? body : new Uint8Array(body);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);
    return { key, url: this.publicUrl(key), size: buf.byteLength, contentType: opts.contentType ?? contentTypeFor(key) };
  }

  async get(key: string) {
    try {
      const data = await fs.readFile(this.resolve(key));
      return { body: new Uint8Array(data), contentType: contentTypeFor(key), size: data.byteLength };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string) {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string) {
    return `${this.publicPrefix}/${assertSafeKey(key)}`;
  }

  async signedUpload() {
    return null;
  }
}
