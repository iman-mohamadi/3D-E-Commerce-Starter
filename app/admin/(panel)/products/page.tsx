import Link from "next/link";
import { asc, count, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { collections, productVariants, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Empty, PageHeader } from "@/admin/components/ui";
import { Money } from "@/admin/components/Money";
import { storage } from "@/server/adapters/storage";

export default async function ProductsPage() {
  const rows = await db
    .select({
      p: products,
      collection: collections.title,
      variants: count(productVariants.id),
      stock: sql<number>`coalesce(sum(${productVariants.stock}), 0)::int`,
    })
    .from(products)
    .leftJoin(collections, eq(collections.id, products.collectionId))
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .groupBy(products.id, collections.title)
    .orderBy(asc(collections.title), asc(products.rackPosition));
  const base = storage().publicUrl("a").slice(0, -1);

  return (
    <>
      <PageHeader title="Products" subtitle={`${rows.length} garments`} actions={<Link href="/admin/products/new" className="btn btn-primary">New product</Link>} />
      {rows.length === 0 ? (
        <Empty>No products yet. Create the first garment.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr><th className="th">Product</th><th className="th">Rack</th><th className="th">3D</th><th className="th">Variants</th><th className="th">Stock</th><th className="th">Base price</th><th className="th">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ p, collection, variants, stock }) => (
                <tr key={p.id} className="hover:bg-raised/40">
                  <td className="td">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-gold">
                      {p.fallbackImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={/^(https?:)?\/\//.test(p.fallbackImageUrl) ? p.fallbackImageUrl : `${base}${p.fallbackImageUrl}`} alt="" className="h-10 w-10 rounded-sm object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-sm border border-line text-[10px] text-mute">3D</span>
                      )}
                      <span><span className="block">{p.title}</span><span className="font-mono text-xs text-mute">{p.slug}</span></span>
                    </Link>
                  </td>
                  <td className="td text-mute">{collection ?? "-"}</td>
                  <td className="td"><span className="chip">{p.glbUrl ? "GLB" : p.proceduralConfig ? "procedural" : "none"}</span></td>
                  <td className="td">{variants}</td>
                  <td className="td">{stock}</td>
                  <td className="td"><Money minor={p.basePrice} /></td>
                  <td className="td"><span className={`chip ${p.isActive ? "border-emerald-700/60 text-emerald-300" : ""}`}>{p.isActive ? "active" : "draft"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
