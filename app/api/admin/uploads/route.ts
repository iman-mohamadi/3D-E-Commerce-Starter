import { NextResponse } from "next/server";
import { prepareUpload, storage, UploadRejected } from "@/server/adapters/storage";
import { uploadKind } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { HttpError } from "@/server/http/errors";

/**
 * Multipart upload through the server (local driver, or small files on S3).
 * Large GLBs on S3 should use POST /api/admin/uploads/sign for a direct-to-bucket PUT.
 */
export const POST = admin(async (_u, req: Request) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = uploadKind.safeParse(form?.get("kind"));
  if (!(file instanceof File) || !kind.success) throw new HttpError(400, "Expected multipart fields: kind, file");

  try {
    const { key, contentType } = prepareUpload(kind.data, file.name, file.size);
    const stored = await storage().put(key, new Uint8Array(await file.arrayBuffer()), { contentType });
    return NextResponse.json({ key: stored.key, url: stored.url, size: stored.size }, { status: 201 });
  } catch (e) {
    if (e instanceof UploadRejected) throw new HttpError(422, e.message);
    throw e;
  }
});
