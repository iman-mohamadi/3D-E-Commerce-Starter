import { StorefrontApp } from "@/storefront/components/StorefrontApp";
import { getStorefrontData } from "@/server/services/storefront";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ rack?: string }> }) {
  const data = await getStorefrontData().catch((e) => {
    console.error("storefront: could not load catalog", e);
    return null;
  });
  if (!data) {
    return (
      <main className="sf-root grid min-h-screen place-items-center p-8 text-center">
        <p className="sf-muted max-w-sm text-sm">The store has not been configured yet. Run the database migrations and seed, then reload.</p>
      </main>
    );
  }
  const { rack } = await searchParams;
  return <StorefrontApp data={data} initialRack={rack} />;
}
