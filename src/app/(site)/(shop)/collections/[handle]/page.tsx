import type { Metadata } from "next";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Container } from "@/components/ui/primitives";
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

  return (
    <Container className="py-10 md:py-14">
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
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href="/shop" className="hover:underline">
          Shop
        </Link>{" "}
        / <span aria-current="page">{collection.title}</span>
      </nav>
      <h1 className="mt-3 text-4xl md:text-5xl">{collection.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-muted">{collection.description}</p>
      {collection.image?.url && <Image src={collection.image.url} alt={collection.image.alt || collection.title} width={1600} height={900} sizes="(max-width: 768px) 100vw, 1200px" className="mt-8 aspect-[16/7] w-full rounded-2xl object-cover" />}
      <ProductGrid products={collection.products} className="mt-10" priorityCount={4} />
    </Container>
  );
}
