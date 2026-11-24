import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { studioPresets } from "@/db/schema";
import { PageHeader, Empty } from "@/admin/components/ui";
import { PresetEditor } from "@/admin/components/PresetEditor";
import { StoreSettingsForm } from "@/admin/components/StoreSettingsForm";
import { getSettings } from "@/server/services/admin";

export default async function SettingsPage() {
  const [s, presets] = await Promise.all([getSettings(), db.select().from(studioPresets).orderBy(asc(studioPresets.name))]);
  if (!s) return <><PageHeader title="Studio Settings" /><Empty>The store settings row is missing. Run <code>npm run db:seed</code>.</Empty></>;

  return (
    <>
      <PageHeader title="Studio Settings" subtitle="Brand, locale, currency and the lighting rigs behind every rack." />
      <section>
        <h2 className="mb-3 font-display text-2xl">Store</h2>
        <StoreSettingsForm
          presets={presets.map((p) => ({ slug: p.slug, name: p.name }))}
          initial={{
            brandName: s.brandName,
            tagline: s.tagline,
            logoUrl: s.logoUrl,
            faviconUrl: s.faviconUrl,
            currency: s.currency,
            currencyDecimals: s.currencyDecimals,
            defaultLocale: s.defaultLocale,
            direction: s.direction,
            freeShippingThreshold: s.freeShippingThreshold,
            flatShippingRate: s.flatShippingRate,
            studioThemePreset: s.studioThemePreset,
          }}
        />
      </section>
      <section className="mt-12">
        <h2 className="mb-3 font-display text-2xl">Studio presets</h2>
        <PresetEditor presets={presets.map((p) => ({ id: p.id, slug: p.slug, name: p.name, config: p.config }))} activeThemeSlug={s.studioThemePreset} />
      </section>
    </>
  );
}
