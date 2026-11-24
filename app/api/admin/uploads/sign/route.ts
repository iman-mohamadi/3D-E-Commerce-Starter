import { NextResponse } from "next/server";
import { prepareUpload, storage, UploadRejected } from "@/server/adapters/storage";
import { uploadSignInput } from "@/shared/schemas/admin";
import { admin } from "@/server/http/admin";
import { HttpError, parseJson } from "@/server/http/errors";

/**
 * Returns a presigned PUT for direct browser -> bucket uploads (S3/R2).
 * `{ direct: false }` for the local driver: the client falls back to POST /api/admin/uploads.
 */
export const POST = admin(async (_u, req: Request) => {
  const input = await parseJson(req, uploadSignInput);
  try {
    const { key, contentType } = prepareUpload(input.kind, input.filename, input.size);
    const signed = await storage().signedUpload(key, { contentType });
    if (!signed) return NextResponse.json({ direct: false });
    return NextResponse.json({ direct: true, ...signed });
  } catch (e) {
    if (e instanceof UploadRejected) throw new HttpError(422, e.message);
    throw e;
  }
});
