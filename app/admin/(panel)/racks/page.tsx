import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { collections, products, studioPresets } from "@/db/schema";
import { PageHeader } from "@/admin/components/ui";
import { RacksManager } from "@/admin/components/RacksManager";

export default async function RacksPage() {
  const [racks, prods, presets] = await Promise.all([
    db.select().from(collections).orderBy(asc(collections.sortOrder)),
    db.select().from(products).orderBy(asc(products.rackPosition)),
    db.select({ slug: studioPresets.slug, name: studioPresets.name }).from(studioPresets).orderBy(asc(studioPresets.name)),
  ]);
  return (
    <>
      <PageHeader title="Racks" subtitle="Collections as they hang in the 3D studio." />
      <RacksManager
        racks={racks.map(({ id, title, slug, description, sortOrder, isDefault, environmentPreset }) => ({ id, title, slug, description, sortOrder, isDefault, environmentPreset }))}
        products={prods.map((p) => ({ id: p.id, title: p.title, collectionId: p.collectionId, rackPosition: p.rackPosition, isActive: p.isActive, kind: p.glbUrl ? "GLB" : (p.proceduralConfig?.kind ?? "-") }))}
        presets={presets}
      />
    </>
  );
}
