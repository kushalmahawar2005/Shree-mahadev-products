import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ComparisonTable } from "@/components/home/ComparisonTable";
import { Reveal } from "@/components/motion/Reveal";
import { Gallery } from "@/components/product/Gallery";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ReviewList } from "@/components/reviews/ReviewList";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { Container, Rating, SwatchDot } from "@/components/ui/primitives";
import { getProduct, getProducts, type Product } from "@/lib/commerce";
import {
  breadcrumbJsonLd,
  jsonLdString,
  pageMetadata,
  productJsonLd,
} from "@/lib/utils/seo";
import { getProductReviews } from "@/lib/server/reviews";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const p = await getProduct(handle);
  if (!p) return {};
  return pageMetadata({
    title: p.seo.title,
    description: p.seo.description,
    path: `/products/${handle}`,
    image: p.images[0]?.url,
  });
}

// Blocking on purpose: an unknown handle must return a real HTTP 404 (not a streamed soft 404).
export const instant = false;

export default async function ProductPage({
  params,
}: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const [related, reviews] = await Promise.all([
    pairsWellWith(product),
    getProductReviews(handle),
  ]);
  const collectionHref =
    product.category === "oil"
      ? "/collections/wood-pressed-oils"
      : product.category === "honey"
        ? "/collections/raw-honey"
        : "/collections/natural-sweeteners";

  const accordion: AccordionItem[] = [
    product.benefits.length && {
      title: "Benefits",
      content: (
        <ul className="list-disc space-y-1 pl-5">
          {product.benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ),
    },
    product.bestFor.length && {
      title: "Best for",
      content: (
        <ul className="flex flex-wrap gap-2">
          {product.bestFor.map((b) => (
            <li
              key={b}
              className="rounded-full bg-khaki-soft px-3 py-1 text-sm text-forest-text"
            >
              {b}
            </li>
          ))}
        </ul>
      ),
    },
    product.howToUse && {
      title: "How to use",
      content: <p>{product.howToUse}</p>,
    },
    product.processNote && {
      title: "How it's made",
      content: <p>{product.processNote}</p>,
    },
    {
      title: "Lab report",
      content: product.labReportUrl ? (
        <a
          href={product.labReportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-forest underline"
        >
          Download lab report (PDF)
        </a>
      ) : (
        <p>
          Lab report coming soon. TODO(client): upload PDF. See all reports on
          the{" "}
          <Link href="/lab-reports" className="text-forest underline">
            lab reports page
          </Link>
          .
        </p>
      ),
    },
    product.shelfLife && {
      title: "Shelf life & storage",
      content: <p>{product.shelfLife}</p>,
    },
  ].filter(Boolean) as AccordionItem[];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            productJsonLd(product),
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Shop", path: "/shop" },
              { name: product.title, path: `/products/${product.handle}` },
            ]),
          ]),
        }}
      />
      <Container className="py-6 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">
            Home
          </Link>{" "}
          /{" "}
          <Link href={collectionHref} className="hover:underline">
            {product.category === "oil"
              ? "Oils"
              : product.category === "honey"
                ? "Honey"
                : "Sweeteners"}
          </Link>{" "}
          / <span aria-current="page">{product.title}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div className="md:sticky md:top-24 md:self-start">
            <Gallery images={product.images} title={product.title} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <SwatchDot color={product.swatch} className="size-4" />
              <p className="font-display text-2xl text-mustard" lang="hi">
                {product.titleHi}
              </p>
            </div>
            <h1 className="mt-1 text-3xl md:text-4xl">{product.title}</h1>
            <Rating
              rating={product.rating}
              count={product.reviewCount}
              size="md"
              className="mt-2"
            />
            <p className="mt-4 text-lg text-ink-muted">
              {product.shortDescription}
            </p>

            <div className="mt-6">
              <ProductPurchase
                handle={product.handle}
                title={product.title}
                variants={product.variants}
              />
            </div>

            <div
              className="prose-sm-custom mt-8 text-ink"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />

            <Accordion items={accordion} defaultOpen={0} className="mt-8" />
          </div>
        </div>
      </Container>

      {product.category === "oil" && (
        <section className="bg-khaki-soft py-12 md:py-16">
          <Container>
            <Reveal>
              <h2 className="mb-6 text-3xl">Kachi ghani vs refined</h2>
              <ComparisonTable compact />
            </Reveal>
          </Container>
        </section>
      )}

      <Container className="py-12 md:py-16">
        <div className="grid gap-12 md:grid-cols-2">
          <Reveal>
            <ReviewList
              reviews={reviews}
              rating={product.rating}
              count={product.reviewCount}
            />
          </Reveal>
          {product.faqs && product.faqs.length > 0 && (
            <Reveal>
              <h2 className="mb-4 text-3xl">FAQs</h2>
              <Accordion
                items={product.faqs.map((f) => ({
                  title: f.q,
                  content: <p>{f.a}</p>,
                }))}
              />
            </Reveal>
          )}
        </div>
      </Container>

      {related.length > 0 && (
        <Container className="pb-16 md:pb-24">
          <Reveal>
            <h2 className="mb-8 text-3xl">Pairs well with</h2>
          </Reveal>
          <ProductGrid products={related} />
        </Container>
      )}
    </>
  );
}

async function pairsWellWith(p: Product) {
  const all = await getProducts();
  const priced = all.filter(
    (x) => x.handle !== p.handle && x.priceRange.min.amount > 0,
  );
  // Prefer something from another category (oil → honey), then same category.
  const other = priced.filter((x) => x.category !== p.category);
  const same = priced.filter(
    (x) => x.category === p.category && x.tags.some((t) => p.tags.includes(t)),
  );
  return [...same.slice(0, 2), ...other.slice(0, 2)].slice(0, 4);
}
