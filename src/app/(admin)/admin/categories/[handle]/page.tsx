import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { PageHeader } from "@/components/admin/ui";
import { listAdminCollections, getCollectionProductHandles } from "@/lib/server/collections";
import { loadProducts } from "@/lib/server/catalog";

export const instant = false;

export default function EditCollectionPage({ params }: { params: Promise<{ handle: string }> }) {
  return <Suspense fallback={<><PageHeader title="Edit collection" intro="Loading collection details…" /><div className="h-72 animate-pulse rounded-2xl bg-khaki-soft" /></>}><Content params={params} /></Suspense>;
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
  }} allProducts={products.map((p) => ({ handle: p.handle, title: p.title, titleHi: p.titleHi }))} />;
}
