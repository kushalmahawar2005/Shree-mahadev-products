import { thumbUrl } from "@/lib/image-loader";
import { VariantImageProvider } from "@/components/product/VariantImage";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Star } from "lucide-react";
import { Banknote, Droplets, Factory, FlaskConical, Leaf, MapPin, ShieldCheck, Sparkles, ThermometerSnowflake, Truck } from "@/components/icons/duo";
import { DetailsTabs, type DetailTab } from "@/components/product/DetailsTabs";
import { SectionHeader, sectionClass } from "@/components/ui/SectionHeader";
import { fullAddress, site, whatsappLink } from "@/data/site";
import { ComparisonTable } from "@/components/home/ComparisonTable";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { Reveal } from "@/components/motion/Reveal";
import { Gallery } from "@/components/product/Gallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { ReviewList } from "@/components/product/ReviewList";
import { BoughtTogether, type BundleItem } from "@/components/product/BoughtTogether";
import { defaultVariant } from "@/lib/commerce/default-variant";
import { WriteReview } from "@/components/reviews/WriteReview";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getProduct, getProducts, type Product } from "@/lib/commerce";
import { getProductReviews, type PublicReview } from "@/lib/server/reviews";
import { getStoreSettings } from "@/lib/server/store-settings";
import { formatMoney } from "@/lib/utils/money";
import { breadcrumbJsonLd, jsonLdString, pageMetadata, productJsonLd } from "@/lib/utils/seo";
import { cn } from "@/lib/utils/cn";

/** Below this many reviews the hero shows "New" instead of an average (a 4.5 from 2 reviews misleads). */
const MIN_REVIEWS_FOR_RATING = 5;

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

  const sizes = product.variants.filter((v) => v.price.amount > 0);
  // This product + one complement from each other category (oil → honey + jaggery).
  const catalog = (await getProducts()).filter((p) => p.handle !== product.handle && p.priceRange.min.amount > 0);
  const others = [...new Set(catalog.map((p) => p.category))].filter((c) => c !== product.category);
  // One bestseller-first pick per other category; if there's only one other category, add a same-category pick.
  const picks = others.map((c) => catalog.find((p) => p.category === c)!).filter(Boolean);
  if (picks.length < 2) picks.push(...catalog.filter((p) => p.category === product.category && !picks.includes(p)).slice(0, 2 - picks.length));
  const bundle: BundleItem[] = [product, ...picks]
    .slice(0, 3)
    .flatMap((p) => {
      const v = defaultVariant(p, (list) => list.find((x) => x.sizeValue === 1000 || x.sizeValue === 500));
      return v && v.price.amount > 0
        ? [{ variantId: v.id, handle: p.handle, title: p.title, size: v.title, price: v.price.amount, image: p.images[0]?.url }]
        : [];
    });
  const tabs: DetailTab[] = [
    {
      id: "about",
      title: "About",
      body: (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="prose-sm-custom max-w-none" dangerouslySetInnerHTML={{ __html: product.descriptionHtml || `<p>${product.shortDescription}</p>` }} />
          {product.benefits.length > 0 && (
            <div>
              <p className="font-semibold text-ink">Good for</p>
              <ul className="mt-3 space-y-2">
                {product.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Leaf className="mt-0.5 size-4 shrink-0 text-forest" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
    },
    product.howToUse || product.bestFor.length
      ? {
          id: "use",
          title: "How to use",
          body: (
            <div>
              {product.bestFor.length > 0 && (
                <ul className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {product.bestFor.map((b) => (
                    <li key={b} className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 font-semibold text-ink">
                      <Droplets className="size-5 shrink-0" /> {b}
                    </li>
                  ))}
                </ul>
              )}
              {product.howToUse && <p>{product.howToUse}</p>}
              {product.shelfLife && <p className="mt-3 text-ink-muted">{product.shelfLife}</p>}
            </div>
          ),
        }
      : null,
    {
      id: "made",
      title: "How it's made",
      body: (
        <div>
          <ol className="grid gap-3 sm:grid-cols-5">
            {["Farm sourced", "Hand cleaned", "Wood pressed", "Cloth filtered", "Bottled"].map((step, i) => (
              <li key={step} className="rounded-2xl border border-line px-4 py-3">
                <span className="text-xs font-semibold text-co-accent-ink tabular-nums">0{i + 1}</span>
                <p className="font-semibold text-ink">{step}</p>
              </li>
            ))}
          </ol>
          {product.processNote && <p className="mt-5">{product.processNote}</p>}
          <Link href="/our-ghani" className="mt-4 inline-flex items-center gap-1 font-semibold text-forest hover:underline">
            Read our story <ArrowRight className="size-4" />
          </Link>
        </div>
      ),
    },
    {
      id: "lab",
      title: "Lab report",
      body: product.labReportUrl ? (
        <a href={product.labReportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-forest underline underline-offset-2">
          <FlaskConical className="size-5" /> View this batch&apos;s lab report (PDF)
        </a>
      ) : (
        // TODO(client): upload this product's lab report PDF.
        <p>
          Every batch is tested before it is packed.{" "}
          <Link href="/lab-reports" className="font-semibold text-forest underline underline-offset-2">
            See our lab reports
          </Link>
          .
        </p>
      ),
    },
    {
      id: "info",
      title: "Product info",
      body: (
        // Legal Metrology (e-commerce) declaration. TODO(client): confirm ingredients + best before per product.
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {[
            ["Product name", product.title],
            ["Ingredients", `100% ${shortTitle(product.title).replace(/\s*(Oil|Raw Honey|Honey)$/i, "").toLowerCase()}${isOil ? " seeds" : ""} (to be confirmed)`],
            ["Net quantity", sizes.map((v) => v.title).join(" · ")],
            ["MRP (incl. of all taxes)", sizes.map((v) => `${v.title} ${formatMoney((v.compareAtPrice ?? v.price).amount)}`).join(" · ")],
            ["Best before", product.shelfLife || "To be confirmed"],
            ["Storage", isOil ? "Store in a cool, dry place away from direct sunlight." : "Store in a cool, dry place. Keep the lid tightly closed."],
            ["Country of origin", "India"],
            ["Manufactured & packed by", `${site.name}, ${fullAddress}`],
            ["FSSAI Lic. No.", site.fssai],
            ["Customer care", `${site.phone} · ${site.email}`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 border-b border-line py-3 sm:flex-row sm:gap-4">
              <dt className="w-44 shrink-0 text-sm text-ink-muted">{k}</dt>
              <dd className="text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  ].filter(Boolean) as DetailTab[];

  return (
    <div className="bg-page">
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

        <VariantImageProvider>
        <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 [&>*]:min-w-0">
          <div className="lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)] lg:self-start">
            <Gallery
              images={product.images}
              title={product.title}
              swatch={product.swatch}
              badge={
                product.tags.includes("bestseller") ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles className="size-3.5 text-co-accent" /> Bestseller
                  </span>
                ) : null
              }
            />
          </div>

          <div>
            <p className="font-hindi text-xl text-sale" lang="hi">
              {product.titleHi}
            </p>
            <h1 className="mt-1 text-[26px] leading-tight sm:text-3xl md:text-[42px]">{product.title}</h1>
            {(product.reviewCount ?? 0) >= MIN_REVIEWS_FOR_RATING ? (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-forest">
                <Stars n={Math.round(product.rating ?? 0)} />
                <span className="font-semibold text-ink">{product.rating?.toFixed(1)}</span>
                <span className="underline-offset-2 hover:underline">{product.reviewCount} reviews</span>
              </a>
            ) : (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-forest">
                <span className="rounded-full bg-co-accent-soft px-2 py-0.5 text-xs font-semibold text-co-accent-ink">New</span>
                Be the first to review
              </a>
            )}
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
              <ProductPurchase handle={product.handle} title={product.title} variants={product.variants} defaultSize={product.defaultSize} image={product.images[0] ? thumbUrl(product.images[0].url, 44) : undefined} />
            </div>

            {/* Trust strip */}
            <ul className="mt-5 grid grid-cols-2 divide-line border-y border-line text-xs sm:grid-cols-4 sm:divide-x">
              {[
                { I: Truck, t: `Free shipping over ${formatMoney(settings.shipping.freeShippingThreshold)}` },
                settings.shipping.codEnabled ? { I: Banknote, t: "Cash on delivery" } : { I: ShieldCheck, t: "Secure payments" },
                { I: FlaskConical, t: "Lab tested batches" },
                { I: MapPin, t: "Made in Bijainagar" },
              ].map(({ I, t }) => (
                <li key={t} className="flex items-center gap-2 px-3 py-3 font-medium text-ink">
                  <I className="size-4 shrink-0 text-forest" /> {t}
                </li>
              ))}
            </ul>

          </div>
        </div>
        </VariantImageProvider>
      </div>

      {/* Highlights */}
      <section className={cn(sectionClass, "pb-0 md:pb-0")} aria-label="Highlights">
        <ul className="grid grid-cols-2 gap-6 border-y border-line py-8 md:grid-cols-4 md:py-10">
          {[
            { I: Factory, t: "Pressed slowly in a wooden ghani" },
            { I: ThermometerSnowflake, t: "No heat, no chemicals" },
            { I: Droplets, t: "Cloth-filtered, naturally settled" },
            { I: FlaskConical, t: "Every batch lab tested" },
          ].map(({ I, t }) => (
            <li key={t} className="flex flex-col gap-3">
              <I className="size-9" />
              <p className="text-[15px] leading-snug font-semibold text-ink">{t}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="details-h">
        <Reveal>
          <SectionHeader id="details-h" eyebrow="उत्पाद की जानकारी" title="Product details" />
          <DetailsTabs tabs={tabs} />
        </Reveal>
      </section>

      {isOil && (
        <section className={cn(sectionClass, "pt-0 md:pt-0")} aria-labelledby="cmp-h">
          <Reveal>
            <SectionHeader id="cmp-h" eyebrow="कच्ची घानी क्यों" title="Kachi ghani vs refined" />
            <ComparisonTable compact />
          </Reveal>
        </section>
      )}

      <section id="reviews" className={cn(sectionClass, "scroll-mt-32 pt-0 md:pt-0")} aria-labelledby="rev-h">
        <SectionHeader id="rev-h" eyebrow="आपकी राय" title="Customer reviews" />
        <ReviewsBlock reviews={reviews} rating={product.rating} count={product.reviewCount} write={<WriteReview productHandle={product.handle} productTitle={product.title} category={product.category} />} />
      </section>

      {product.faqs && product.faqs.length > 0 && (
        <section className={cn(sectionClass, "pt-0 md:pt-0")} aria-labelledby="faq-h">
          <SectionHeader id="faq-h" eyebrow="सवाल-जवाब" title="Questions, answered" />
          <Accordion type="single" collapsible className="max-w-3xl rounded-3xl border border-line bg-white px-5">
            {product.faqs.map((f, n) => (
              <AccordionItem key={f.q} value={`faq-${n}`} className="border-line">
                <AccordionTrigger className="py-4 text-left text-base font-semibold text-ink hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-[15px] leading-relaxed text-ink">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <a
            href={whatsappLink(`Hi, I have a question about ${product.title}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink hover:border-forest"
          >
            Ask a question on WhatsApp
          </a>
        </section>
      )}

      {bundle.length > 2 && (
        <section className={cn(sectionClass, "pt-0 md:pt-0")} aria-labelledby="fbt-h">
          <SectionHeader id="fbt-h" eyebrow="साथ में ख़रीदें" title="Frequently bought together" />
          <BoughtTogether items={bundle} />
        </section>
      )}

      {related.length > 0 && (
        <section className={cn(sectionClass, "pt-0 md:pt-0")} aria-labelledby="pair-h">
          <SectionHeader
            id="pair-h"
            eyebrow="साथ में लें"
            title="Pairs well with"
            action={
              <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline">
                Shop all <ArrowRight className="size-4" />
              </Link>
            }
          />
          <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <li key={p.handle}>
                <PickCard product={toPickProduct(p)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecentlyViewed current={product.handle} products={(await getProducts()).filter((p) => p.priceRange.min.amount > 0).map(toPickProduct)} />
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
      <div className="rounded-3xl bg-forest p-5 text-white sm:p-6 lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)]">
        <p className="text-lg font-semibold text-white">Overall rating</p>
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
                  <Star className="size-3 fill-co-accent text-co-accent" />
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span className="block h-full rounded-full bg-co-accent" style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} />
                  </span>
                  <span className="w-4 text-right text-white/60 tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/75">No reviews yet. Bought this? Review it from your orders.</p>
        )}
        {write}
      </div>

      <ReviewList reviews={reviews} />
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
