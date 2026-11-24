import { env } from "../../config/env";
import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";
import type { StorageAdapter } from "./types";

export * from "./types";
export * from "./policy";

let instance: StorageAdapter | undefined;

export function createStorage(): StorageAdapter {
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
      throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
    }
    return new S3StorageAdapter({
      bucket: e.S3_BUCKET,
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      publicBaseUrl: e.S3_PUBLIC_BASE_URL,
    });
  }
  return new LocalStorageAdapter(e.STORAGE_LOCAL_DIR);
}

export function storage(): StorageAdapter {
  return (instance ??= createStorage());
}
