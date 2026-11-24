import { storage } from "@/server/adapters/storage";
import { handle, HttpError } from "@/server/http/errors";

/** Serves objects for the local storage driver. With the S3 driver, URLs point at the bucket/CDN instead. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ key: string[] }> }) => {
  const adapter = storage();
  if (adapter.driver !== "local") throw new HttpError(404, "Not found");
  const key = (await ctx.params).key.join("/");
  let file;
  try {
    file = await adapter.get(key);
  } catch {
    throw new HttpError(400, "Invalid key");
  }
  if (!file) throw new HttpError(404, "Not found");
  return new Response(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // SVG uploads could carry script; never let them execute from our origin.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
