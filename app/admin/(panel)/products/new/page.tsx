import { ProductEditor } from "@/admin/studio/ProductEditor";
import { PageHeader } from "@/admin/components/ui";
import { loadEditorData } from "@/server/services/admin-pages";

export default async function NewProduct() {
  const data = (await loadEditorData(null))!;
  return (
    <>
      <PageHeader title="New product" subtitle="Create the garment, then add variants and hotspots with the live 3D studio." />
      <ProductEditor productId={null} initial={{ draft: data.draft, variants: data.variants, hotspots: data.hotspots }} collections={data.collections} presets={data.presets} storeThemePreset={data.storeThemePreset} />
    </>
  );
}
