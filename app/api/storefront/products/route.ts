import { handle } from "@/server/http/errors";
import { publicJson } from "@/server/http/public";
import { getPublicRacks } from "@/server/services/storefront";

/** Active products with variants + hotspots. Optional ?collection=<slug>. */
export const GET = handle(async (req: Request) => {
  const slug = new URL(req.url).searchParams.get("collection") ?? undefined;
  const racks = await getPublicRacks({ slug, withProducts: true });
  return publicJson({ products: racks.flatMap((r) => r.products.map((p) => ({ ...p, collection: r.slug }))) });
});
