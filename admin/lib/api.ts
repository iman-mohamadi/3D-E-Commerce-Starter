export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** JSON fetch for /api/admin/**. Throws ApiError with the server's message (incl. Zod field errors). */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg: string = data?.error ?? `Request failed (${res.status})`;
    const fields = data?.details?.fieldErrors as Record<string, string[]> | undefined;
    if (fields) {
      const first = Object.entries(fields)[0];
      if (first) msg += `: ${first[0]} - ${first[1]?.[0]}`;
    }
    throw new ApiError(msg, res.status, data?.details);
  }
  return data as T;
}

export type UploadKind = "model" | "texture" | "environment" | "image" | "brand";

/**
 * Uploads a file: presigned direct-to-bucket PUT when the storage driver supports it (S3/R2),
 * otherwise multipart through /api/admin/uploads (local driver). Returns the storage key to save in the DB.
 */
export async function uploadAsset(kind: UploadKind, file: File, onProgress?: (pct: number) => void): Promise<string> {
  const sign = await api<{ direct: boolean; key?: string; url?: string; headers?: Record<string, string> }>("/api/admin/uploads/sign", {
    body: { kind, filename: file.name, size: file.size },
  });

  if (sign.direct && sign.url && sign.key) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sign.url!);
      for (const [k, v] of Object.entries(sign.headers ?? {})) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(`Direct upload failed (${xhr.status})`, xhr.status)));
      xhr.onerror = () => reject(new ApiError("Direct upload failed (network/CORS)", 0));
      xhr.send(file);
    });
    return sign.key;
  }

  return new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { key?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status < 300 && data.key) resolve(data.key);
      else reject(new ApiError(data.error ?? `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Upload failed (network)", 0));
    xhr.send(form);
  });
}
