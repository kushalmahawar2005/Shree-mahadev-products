import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, Banknote, Droplets, FlaskConical, Leaf, MapPin, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import { ComparisonTable } from "@/components/home/ComparisonTable";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { Reveal } from "@/components/motion/Reveal";
import { Gallery } from "@/components/product/Gallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { WriteReview } from "@/components/reviews/WriteReview";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getProduct, getProducts, type Product } from "@/lib/commerce";
import { getProductReviews, type PublicReview } from "@/lib/server/reviews";
import { getStoreSettings } from "@/lib/server/store-settings";
import { formatMoney } from "@/lib/utils/money";
import { breadcrumbJsonLd, jsonLdString, pageMetadata, productJsonLd } from "@/lib/utils/seo";
import { cn } from "@/lib/utils/cn";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: PageProps<"/products/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const p = await getProduct(handle);
  if (!p) return {};
  return pageMetadata({ title: p.seo.title, description: p.seo.description, path: `/products/${handle}`, image: p.images[0]?.url });
}

// Blocking on purpose: an unknown handle must return a real HTTP 404 (not a streamed soft 404).
export const instant = false;

const CATEGORY = {
  oil: { label: "Wood-pressed oils", href: "/collections/wood-pressed-oils" },
  honey: { label: "Raw honey", href: "/collections/raw-honey" },
  sweetener: { label: "Natural sweeteners", href: "/collections/natural-sweeteners" },
} as const;

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

export default async function ProductPage({ params }: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const [related, reviews, settings] = await Promise.all([pairsWellWith(product), getProductReviews(handle), getStoreSettings()]);
  const cat = CATEGORY[product.category as keyof typeof CATEGORY] ?? CATEGORY.oil;
  const isOil = product.category === "oil";

  const details = [
    product.benefits.length > 0 && {
      id: "benefits",
      title: "Benefits",
      body: (
        <ul className="grid gap-2 sm:grid-cols-2">
          {product.benefits.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Leaf className="mt-0.5 size-4 shrink-0 text-forest" /> {b}
            </li>
          ))}
        </ul>
      ),
    },
    product.howToUse && { id: "use", title: "How to use", body: <p>{product.howToUse}</p> },
    product.processNote && { id: "made", title: "How it's made", body: <p>{product.processNote}</p> },
    {
      id: "lab",
      title: "Lab report",
      body: product.labReportUrl ? (
        <a href={product.labReportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-forest underline underline-offset-2">
          <FlaskConical className="size-4" /> View this batch&apos;s lab report (PDF)
        </a>
      ) : (
        // TODO(client): upload this product's lab report PDF.
        <p>
          Every batch is tested.{" "}
          <Link href="/lab-reports" className="font-semibold text-forest underline underline-offset-2">
            See our lab reports
          </Link>
          .
        </p>
      ),
    },
    product.shelfLife && { id: "shelf", title: "Shelf life & storage", body: <p>{product.shelfLife}</p> },
  ].filter(Boolean) as { id: string; title: string; body: React.ReactNode }[];

  return (
    <div className="bg-[#F5EDDE]">
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

      <div className="mx-auto max-w-[1360px] px-4 pt-5 pb-14 md:px-8 md:pt-7 md:pb-20">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={cat.href}>{cat.label}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{shortTitle(product.title)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)] lg:self-start">
            <Gallery
              images={product.images}
              title={product.title}
              swatch={product.swatch}
              badge={
                product.tags.includes("bestseller") ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles className="size-3.5 text-[#e8c879]" /> Bestseller
                  </span>
                ) : null
              }
            />
          </div>

          <div>
            <p className="font-hindi text-xl text-sale" lang="hi">
              {product.titleHi}
            </p>
            <h1 className="mt-1 text-3xl leading-tight md:text-[42px]">{product.title}</h1>
            {product.reviewCount ? (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-forest">
                <Stars n={Math.round(product.rating ?? 0)} />
                <span className="font-semibold text-ink">{product.rating?.toFixed(1)}</span>
                <span className="underline-offset-2 hover:underline">
                  {product.reviewCount} review{product.reviewCount === 1 ? "" : "s"}
                </span>
              </a>
            ) : null}
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">{product.shortDescription}</p>

            {product.bestFor.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {product.bestFor.map((b) => (
                  <li key={b} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-forest-text">
                    <Droplets className="size-3.5 text-mustard" /> {b}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:p-6">
              <ProductPurchase handle={product.handle} title={product.title} variants={product.variants} image={product.images[0]?.url} />
            </div>

            {/* Trust strip */}
            <ul className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                { I: Truck, t: `Free shipping over ${formatMoney(settings.shipping.freeShippingThreshold)}` },
                settings.shipping.codEnabled ? { I: Banknote, t: "Cash on delivery" } : { I: ShieldCheck, t: "Secure payments" },
                { I: FlaskConical, t: "Lab tested batches" },
                { I: MapPin, t: "Made in Bijainagar" },
              ].map(({ I, t }) => (
                <li key={t} className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2.5 font-medium text-forest-text">
                  <I className="size-4 shrink-0 text-forest" /> {t}
                </li>
              ))}
            </ul>

            {product.descriptionHtml && (
              <div className="prose-sm-custom mt-8 leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
            )}

            <Accordion type="multiple" defaultValue={[details[0]?.id ?? ""]} className="mt-6 rounded-3xl border border-line bg-white px-5">
              {details.map((d) => (
                <AccordionItem key={d.id} value={d.id} className="border-line">
                  <AccordionTrigger className="py-4 text-base font-semibold text-forest-text hover:no-underline">{d.title}</AccordionTrigger>
                  <AccordionContent className="pb-5 text-[15px] leading-relaxed text-ink">{d.body}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>

      {isOil && (
        <section className="paper-grain bg-[#efe4cf] py-12 md:py-16">
          <div className="mx-auto max-w-[1360px] px-4 md:px-8">
            <Reveal>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">Why kachi ghani</p>
              <h2 className="mt-1 mb-6 text-3xl md:text-4xl">Kachi ghani vs refined</h2>
              <ComparisonTable compact />
            </Reveal>
          </div>
        </section>
      )}

      <section id="reviews" className="mx-auto max-w-[1360px] scroll-mt-32 px-4 py-12 md:px-8 md:py-16">
        <ReviewsBlock reviews={reviews} rating={product.rating} count={product.reviewCount} write={<WriteReview productHandle={product.handle} productTitle={product.title} category={product.category} />} />
      </section>

      {product.faqs && product.faqs.length > 0 && (
        <section className="mx-auto max-w-[900px] px-4 pb-12 md:px-8 md:pb-16">
          <h2 className="mb-5 text-3xl">Questions, answered</h2>
          <Accordion type="single" collapsible className="rounded-3xl border border-line bg-white px-5">
            {product.faqs.map((f, n) => (
              <AccordionItem key={f.q} value={`faq-${n}`} className="border-line">
                <AccordionTrigger className="py-4 text-left text-base font-semibold text-forest-text hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-[15px] leading-relaxed text-ink">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {related.length > 0 && (
        <section className="mx-auto max-w-[1360px] px-4 pb-16 md:px-8 md:pb-24">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-3xl md:text-4xl">Pairs well with</h2>
            <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline">
              Shop all <ArrowRight className="size-4" />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <li key={p.handle}>
                <PickCard product={toPickProduct(p)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)} aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-4", i < n ? "fill-[#f5b400] text-[#f5b400]" : "fill-line text-line")} />
      ))}
    </span>
  );
}

function ReviewsBlock({ reviews, rating, count, write }: { reviews: PublicReview[]; rating?: number; count?: number; write: React.ReactNode }) {
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
      <div className="rounded-3xl bg-forest lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)] p-6 text-white">
        <h2 className="text-2xl text-white">Customer reviews</h2>
        {count ? (
          <>
            <p className="mt-4 text-5xl font-extrabold tabular-nums">{rating?.toFixed(1)}</p>
            <Stars n={Math.round(rating ?? 0)} className="mt-2" />
            <p className="mt-1 text-sm text-white/70">
              {count} review{count === 1 ? "" : "s"}
            </p>
            <ul className="mt-5 space-y-1.5">
              {dist.map(({ s, n }) => (
                <li key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums">{s}</span>
                  <Star className="size-3 fill-[#e8c879] text-[#e8c879]" />
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span className="block h-full rounded-full bg-[#e8c879]" style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} />
                  </span>
                  <span className="w-4 text-right text-white/60 tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/75">No reviews yet. Bought this? Tell others how it was.</p>
        )}
        {write}
      </div>

      {reviews.length > 0 ? (
        <ul className="grid content-start gap-4 md:grid-cols-2">
          {reviews.slice(0, 6).map((r) => (
            <li key={r.id} className="flex flex-col rounded-3xl border border-line bg-white p-5">
              <Stars n={r.rating} />
              {r.title && <h3 className="mt-3 text-lg leading-snug">{r.title}</h3>}
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{r.body}</p>
              <p className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-ink">
                {r.name}
                {r.verified && <BadgeCheck className="size-4 text-forest" aria-label="Verified buyer" />}
                <span className="font-normal text-ink-muted">
                  {r.city ? `· ${r.city}` : ""}
                  {r.verified ? " · Verified buyer" : ""}
                </span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink-muted">Reviews from real buyers will show up here.</div>
      )}
    </div>
  );
}

async function pairsWellWith(p: Product) {
  const all = await getProducts();
  const priced = all.filter((x) => x.handle !== p.handle && x.priceRange.min.amount > 0);
  // Prefer something from another category (oil → honey), then same category.
  const other = priced.filter((x) => x.category !== p.category);
  const same = priced.filter((x) => x.category === p.category && x.tags.some((t) => p.tags.includes(t)));
  return [...same.slice(0, 2), ...other.slice(0, 2)].slice(0, 4);
}
