import { notFound } from "next/navigation";
import { z } from "zod";
import { ProductEditor } from "@/admin/studio/ProductEditor";
import { PageHeader } from "@/admin/components/ui";
import { loadEditorData } from "@/server/services/admin-pages";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const data = await loadEditorData(id.data);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={data.draft.title || "Untitled"} subtitle="Product studio" />
      <ProductEditor key={id.data} productId={id.data} initial={{ draft: data.draft, variants: data.variants, hotspots: data.hotspots }} collections={data.collections} presets={data.presets} storeThemePreset={data.storeThemePreset} />
    </>
  );
}
