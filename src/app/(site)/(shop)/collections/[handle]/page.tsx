import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Container } from "@/components/ui/primitives";
import { getCollection, getCollections } from "@/lib/commerce";
import { breadcrumbJsonLd, jsonLdString, pageMetadata } from "@/lib/utils/seo";

export async function generateStaticParams() {
  const collections = await getCollections();
  return collections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const c = await getCollection(handle);
  if (!c) return {};
  return pageMetadata({ title: c.title, description: c.description, path: `/collections/${handle}` });
}

// Blocking on purpose: an unknown handle must return a real HTTP 404 (not a streamed soft 404).
export const instant = false;

export default async function CollectionPage({ params }: PageProps<"/collections/[handle]">) {
  const { handle } = await params;
  const collection = await getCollection(handle);
  if (!collection) notFound();

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
      <ProductGrid products={collection.products} className="mt-10" priorityCount={4} />
    </Container>
  );
}
