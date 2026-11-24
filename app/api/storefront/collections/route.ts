import { handle } from "@/server/http/errors";
import { publicJson } from "@/server/http/public";
import { getPublicRacks } from "@/server/services/storefront";

/** Racks with their resolved studio preset (lighting / rack layout / camera). Products via /api/storefront/products. */
export const GET = handle(async () => publicJson({ collections: await getPublicRacks() }));
