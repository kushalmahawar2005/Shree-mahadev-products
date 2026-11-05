import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { Skeleton } from "@/components/shadcn/skeleton";
import { listAdminCollections, getCollectionProductHandles } from "@/lib/server/collections";
import { loadProducts } from "@/lib/server/catalog";

export const instant = false;
export const metadata = { title: "Edit collection" };

export default function EditCollectionPage({ params }: { params: Promise<{ handle: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5" aria-label="Loading collection">
          <Skeleton className="h-12 w-80 bg-surface" />
          <Skeleton className="h-96 rounded-2xl bg-surface" />
        </div>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ handle: string }> }) {
  await connection();
  const { handle } = await params;
  const [collections, products, membership] = await Promise.all([
    listAdminCollections(), loadProducts({ status: "any" }), getCollectionProductHandles(handle),
  ]);
  const row = collections.find((c) => c.handle === handle);
  if (!row) notFound();
  return <CollectionEditor initial={{
    handle: row.handle, title: row.title, description: row.description, imageUrl: row.imageUrl,
    seoTitle: row.seoTitle, seoDescription: row.seoDescription, inMenu: row.inMenu,
    menuOrder: row.menuOrder, showHomepage: row.showHomepage, products: membership,
  }} allProducts={products.map((p) => ({ handle: p.handle, title: p.title, titleHi: p.titleHi, image: p.images[0]?.url ?? "", swatch: p.swatch ?? null, status: p.status, from: p.priceRange.min.amount }))} />;
}
