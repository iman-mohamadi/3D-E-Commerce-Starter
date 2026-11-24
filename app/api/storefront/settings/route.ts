import { handle, HttpError } from "@/server/http/errors";
import { publicJson } from "@/server/http/public";
import { getPublicSettings } from "@/server/services/storefront";

export const GET = handle(async () => {
  const settings = await getPublicSettings();
  if (!settings) throw new HttpError(404, "Store is not configured");
  return publicJson({ settings });
});
