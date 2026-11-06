import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { ShopListing } from "@/components/product/ShopListing";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getCollection, getCollections } from "@/lib/commerce";
import { getCollectionRedirect } from "@/lib/server/collections";
import { breadcrumbJsonLd, jsonLdString, pageMetadata } from "@/lib/utils/seo";

export async function generateStaticParams() {
  const collections = await getCollections();
  return collections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const c = await getCollection(handle);
  if (!c) return {};
  return pageMetadata({ title: c.seoTitle || c.title, description: c.seoDescription || c.description, path: `/collections/${handle}` });
}

// Blocking on purpose: an unknown handle must return a real HTTP 404 (not a streamed soft 404).
export const instant = false;

export default async function CollectionPage({ params }: PageProps<"/collections/[handle]">) {
  const { handle } = await params;
  const collection = await getCollection(handle);
  if (!collection) {
    await connection();
    const destination = await getCollectionRedirect(handle);
    if (destination) permanentRedirect(destination);
    notFound();
  }

  // Single-category collections don't need the category filter.
  const single = new Set(collection.products.map((p) => p.category)).size <= 1;

  return (
    <div className="bg-[#F5EDDE]">
      <div className="mx-auto max-w-[1360px] px-4 pt-6 pb-16 md:px-8 md:pt-8 md:pb-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              breadcrumbJsonLd([
                { name: "Home", path: "/" },
                { name: "Shop", path: "/shop" },
                { name: collection.title, path: `/collections/${handle}` },
              ]),
            ),
          }}
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/shop">Shop</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{collection.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-3 text-2xl md:text-3xl">{collection.title}</h1>
        {collection.description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{collection.description}</p>}
        <Suspense fallback={<div className="mt-10 h-96" />}>
          <ShopListing products={collection.products} hideCategory={single} />
        </Suspense>
      </div>
    </div>
  );
}
