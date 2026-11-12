import { thumbUrl } from "@/lib/image-loader";
import { VariantImageProvider } from "@/components/product/VariantImage";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Star } from "lucide-react";
import { PaymentLogos } from "@/components/layout/PaymentLogos";
import { BadgePercent, Banknote, Droplets, Factory, FlaskConical, Leaf, MapPin, ShieldCheck, ThermometerSnowflake, Truck } from "@/components/icons/duo";
import { DetailsTabs, type DetailTab } from "@/components/product/DetailsTabs";
import { SectionHeader, sectionClass } from "@/components/ui/SectionHeader";
import { fullAddress, site, whatsappLink } from "@/data/site";
import { GhaniVsRefined } from "@/components/product/GhaniVsRefined";
import { getPublicLeadPopup } from "@/lib/server/leads";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { Reveal } from "@/components/motion/Reveal";
import { Gallery } from "@/components/product/Gallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { BAND, Band, HomeChecks, StoryBand } from "@/components/product/PdpStory";
import { MethodSteps } from "@/components/product/MethodSteps";
import { RecordView } from "@/components/product/RecentlyViewed";
import type { Art } from "@/data/brand-art";
import { pdpArt, pdpMustardScene } from "@/data/pdp-art";
import { Reels, type ReelItem } from "@/components/home/Reels";
import { sceneFor, storyFor } from "@/data/pdp-story";
import { ReviewList } from "@/components/product/ReviewList";
import { BoughtTogether, type BundleItem } from "@/components/product/BoughtTogether";
import { defaultVariant } from "@/lib/commerce/default-variant";
import { WriteReview } from "@/components/reviews/WriteReview";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getProduct, getProducts, type Product } from "@/lib/commerce";
import { getOtherProductReviews, getProductReviews, type PublicReview } from "@/lib/server/reviews";
import { BadgeCheck } from "lucide-react";
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

/** One PDP band: its tint, its own corner ornament and the section inside. */
const band = (tone: keyof typeof BAND, art: Art | undefined, ...rest: [React.ReactNode] | [string, React.ReactNode]) =>
  rest.length === 2 ? { tone, art, artClass: rest[0], node: rest[1] } : { tone, art, artClass: undefined, node: rest[0] };

/** Short process reels shown as the last gallery slide on oil pages. */
const REELS = {
  ghani: { src: "/videos/reels/ghani-pour.mp4", poster: "/videos/reels/ghani-pour.jpg", label: "Fresh oil pouring from our ghani" },
  coconut: { src: "/videos/reels/coconut-in.mp4", poster: "/videos/reels/coconut-in.jpg", label: "Coconut going into our ghani" },
};

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

export default async function ProductPage({ params }: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const [related, reviews, settings, welcome] = await Promise.all([pairsWellWith(product), getProductReviews(handle), getStoreSettings(), getPublicLeadPopup()]);
  // No reviews here yet: show real, approved reviews of our other products instead of an empty box.
  const otherReviews = reviews.length ? [] : await getOtherProductReviews(product.handle);
  const cat = CATEGORY[product.category as keyof typeof CATEGORY] ?? CATEGORY.oil;
  const isOil = product.category === "oil";

  const sizes = product.variants.filter((v) => v.price.amount > 0);
  // This product + one complement from each other category (oil → honey + jaggery).
  const catalog = (await getProducts()).filter((p) => p.handle !== product.handle && p.priceRange.min.amount > 0);
  // A sensible set: one more from the same shelf (oil → another oil) + one from another shelf (honey / jaggery).
  const picks = [catalog.find((p) => p.category === product.category), catalog.find((p) => p.category !== product.category)].filter(
    (p): p is Product => !!p,
  );
  const bundle: BundleItem[] = [product, ...picks]
    .slice(0, 3)
    .flatMap((p) => {
      const v = defaultVariant(p, (list) => list.find((x) => x.sizeValue === 1000 || x.sizeValue === 500));
      return v && v.price.amount > 0
        ? [{ variantId: v.id, handle: p.handle, title: p.title, size: v.title, price: v.price.amount, mrp: v.compareAtPrice?.amount, image: p.images[0]?.url }]
        : [];
    });
  const story = storyFor(product.category);
  // Our own ghani clips, each tagged with this product so "Add to cart" in the viewer adds it.
  const onSale = product.variants.filter((v) => v.availableForSale);
  const dv = defaultVariant(product);
  const reelItems: ReelItem[] = (story.reels ?? []).map((r, n) => ({
    id: -(n + 1),
    videoUrl: r.video,
    caption: r.caption,
    instagramUrl: null,
    product: {
      handle: product.handle,
      title: product.title,
      image: product.images[0]?.url,
      price: dv?.price.amount,
      variantId: dv?.id,
      variantTitle: dv?.title,
      variants: onSale.map((x) => ({ id: x.id, title: x.title, price: x.price.amount })),
    },
  }));
  const promises = isOil
    ? [
        { I: Factory, t: "Kachi ghani pressed" },
        { I: ThermometerSnowflake, t: "No external heat" },
        { I: Droplets, t: "Cloth filtered" },
        { I: FlaskConical, t: "Lab tested" },
      ]
    : [
        { I: Leaf, t: "Nothing added" },
        { I: FlaskConical, t: "Lab tested" },
        { I: ShieldCheck, t: "FSSAI licensed" },
        { I: MapPin, t: "Packed in Bijainagar" },
      ];
  // Real offers only: first-order coupon (when the welcome popup is on), free delivery, COD.
  const offers: Offer[] = [
    ...(welcome ? [{ I: BadgePercent, title: `${welcome.percent}% off`, sub: "on your first order" }] : []),
    { I: Truck, title: "Free delivery", sub: `on orders above ${formatMoney(settings.shipping.freeShippingThreshold)}` },
    ...(settings.shipping.codEnabled ? [{ I: Banknote, title: "Cash on delivery", sub: "pay when it arrives" }] : []),
  ];
  const tabs: DetailTab[] = [
    {
      id: "about",
      title: "About",
      body: (
        <div className="space-y-4">
          <div className="prose-sm-custom max-w-none text-ink" dangerouslySetInnerHTML={{ __html: product.descriptionHtml || `<p>${product.shortDescription}</p>` }} />
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
                <ul className="mb-4 grid grid-cols-2 gap-2">
                  {product.bestFor.map((b) => (
                    <li key={b} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink">
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
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {["Farm sourced", "Hand cleaned", "Wood pressed", "Cloth filtered", "Bottled"].map((step, i) => (
              <li key={step} className="rounded-xl border border-line bg-surface px-3 py-2.5">
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
        <dl>
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
            <div key={k} className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-0 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm text-ink-muted">{k}</dt>
              <dd className="text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    product.faqs?.length
      ? {
          id: "faqs",
          title: "FAQs",
          body: (
            <div>
              <dl className="space-y-4">
                {product.faqs.map((f) => (
                  <div key={f.q}>
                    <dt className="font-semibold text-ink">{f.q}</dt>
                    <dd className="mt-1">{f.a}</dd>
                  </div>
                ))}
              </dl>
              <a
                href={whatsappLink(`Hi, I have a question about ${product.title}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline"
              >
                Ask us on WhatsApp <ArrowRight className="size-4" />
              </a>
            </div>
          ),
        }
      : null,
  ].filter(Boolean) as DetailTab[];

  return (
    <div className="co-theme bg-page">
      <RecordView handle={product.handle} />
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
            ...(product.faqs?.length
              ? [
                  {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: product.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
                  },
                ]
              : []),
          ]),
        }}
      />

      <div className="mx-auto max-w-[1360px] px-4 pt-5 pb-14 md:px-8 md:pt-7 md:pb-20">
        <Breadcrumb>
          <BreadcrumbList className="no-scrollbar flex-nowrap overflow-x-auto whitespace-nowrap">
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
        <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12 xl:gap-16 [&>*]:min-w-0">
          <div className="lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)] lg:self-start">
            <Gallery
              images={product.images}
              title={product.title}
              swatch={product.swatch}
              video={isOil ? (product.handle.includes("coconut") ? REELS.coconut : REELS.ghani) : undefined}
            />
          </div>

          <div>
            {/* Compact header: name (+ Hindi), rating, one-line pitch, one row of tags. */}
            <h1 className="font-display text-[28px] leading-tight tracking-[-0.02em] sm:text-[34px]">
              {shortTitle(product.title)}
              <span className="font-hindi ml-3 align-middle text-lg font-normal tracking-normal text-co-accent-ink" lang="hi">
                {product.titleHi}
              </span>
            </h1>
            <a href="#reviews" className="mt-1.5 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-forest">
              {(product.reviewCount ?? 0) >= MIN_REVIEWS_FOR_RATING ? (
                <>
                  <Stars n={Math.round(product.rating ?? 0)} />
                  <span className="font-semibold text-ink">{product.rating?.toFixed(1)}</span>
                  <span className="underline-offset-2 hover:underline">{product.reviewCount} reviews</span>
                </>
              ) : (
                <>
                  <Stars n={0} />
                  <span className="underline-offset-2 hover:underline">New · be the first to review</span>
                </>
              )}
            </a>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">{product.shortDescription}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
              {product.tags.includes("bestseller") && <li className="rounded-full bg-forest px-2.5 py-1 text-white">Bestseller</li>}
              {isOil && <li className="rounded-full bg-co-accent-soft px-2.5 py-1 text-co-accent-ink">Kachi ghani</li>}
              {product.bestFor.map((b) => (
                <li key={b} className="rounded-full bg-co-brand-soft px-2.5 py-1 text-forest-text">
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <ProductPurchase
                handle={product.handle}
                title={product.title}
                variants={product.variants}
                defaultSize={product.defaultSize}
                lowStock={settings.lowStockThreshold}
                image={product.images[0] ? thumbUrl(product.images[0].url, 44) : undefined}
                offers={<Offers items={offers} />}
                footer={
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                      <ShieldCheck className="size-3.5" /> Secure checkout
                    </span>
                    <PaymentLogos size="sm" />
                  </div>
                }
              />
            </div>

            {/* Product promise: four icon badges (real process facts, no health claims). */}
            <ul className="mt-6 grid grid-cols-4 gap-2 border-y border-line py-4">
              {promises.map(({ I, t }) => (
                <li key={t} className="flex flex-col items-center gap-1.5 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-co-brand-soft">
                    <I className="size-6" />
                  </span>
                  <span className="text-[11px] leading-tight font-semibold text-ink-muted">{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-2" id="details">
              <DetailsTabs tabs={tabs} />
            </div>
          </div>
        </div>
        </VariantImageProvider>
      </div>

      {[
        story.reels && reelItems.length > 0 ? band("forest", undefined,
          <Reels key="reels" align="left" dark eyebrow="घानी से सीधा" title="Our ghani, in action" subtitle="Real clips from our ghani in Bijainagar. Tap any reel to watch." reels={reelItems} />,
        ) : null,
        story.method ? band("ivory", pdpArt.method, <MethodSteps key="method" {...story.method} />) : null,
        isOil ? band("green", pdpArt.compare,
          <section key="cmp" className={sectionClass} aria-labelledby="cmp-h">
            <Reveal>
              <SectionHeader id="cmp-h" eyebrow="कच्ची घानी क्यों" title="Kachi ghani vs refined" subtitle="Same seed, two very different oils." />
              <GhaniVsRefined />
            </Reveal>
          </section>,
        ) : null,
        story.checks ? band("mustard", pdpArt.checks, <HomeChecks key="checks" {...story.checks} />) : null,
        band("ivory", pdpArt.reviews,
        <section key="reviews" id="reviews" className={cn(sectionClass, "scroll-mt-32")} aria-labelledby="rev-h">
          <SectionHeader id="rev-h" eyebrow="आपकी राय" title="Customer reviews" />
          <ReviewsBlock others={otherReviews} productTitle={shortTitle(product.title)} reviews={reviews} rating={product.rating} count={product.reviewCount} write={<WriteReview productHandle={product.handle} productTitle={product.title} category={product.category} />} />
        </section>),
        bundle.length > 2 ? band("green", undefined,
          <section key="set" className={sectionClass} aria-labelledby="fbt-h">
            <SectionHeader id="fbt-h" eyebrow="साथ में लें" title="Complete your kitchen" subtitle="Choose your favourites from our family of everyday essentials." />
            <BoughtTogether items={bundle} />
          </section>,
        ) : null,
        related.length > 0 ? band("ivory", undefined,
          <section key="related" className={sectionClass} aria-labelledby="pair-h">
            <SectionHeader
              id="pair-h"
              eyebrow="और भी देखें"
              title="You may also like"
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
          </section>,
        ) : null,
        band("mustard", pdpArt.story, "top-0 right-0 hidden w-[280px] md:block", <StoryBand key="story" isOil={isOil} scene={isOil ? pdpMustardScene : sceneFor(product.handle)} />),
      ]
        .filter((b) => b !== null)
        .map((b, i) => (
          <Band key={i} tone={b.tone} art={b.art} artClass={b.artClass}>
            {b.node}
          </Band>
        ))}
    </div>
  );
}

type Offer = { I: React.ComponentType<{ className?: string }>; title: string; sub: string };

/** Real offers under the price: one soft panel, one line each. */
function Offers({ items }: { items: Offer[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-4 divide-y divide-co-accent/20 rounded-2xl bg-co-accent-soft/70 px-4 text-sm">
      {items.map(({ I, title, sub }) => (
        <li key={title} className="flex items-center gap-2.5 py-2.5">
          <I className="size-5 shrink-0" />
          <span className="text-ink">
            <span className="font-semibold">{title}</span> <span className="text-ink-muted">{sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** No reviews for this product yet: one invite strip, then real reviews from our other products (labelled). */
function EmptyReviews({ others, productTitle, write }: { others: PublicReview[]; productTitle: string; write: React.ReactNode }) {
  return (
    <div>
      <div className="flex flex-col gap-4 rounded-3xl bg-forest px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div>
          <p className="text-lg font-semibold text-white">Be the first to review {productTitle}</p>
          <p className="mt-1 text-sm text-white/70">Bought it? Tell others how it tastes in your kitchen. Reviews open from your orders.</p>
        </div>
        <div className="shrink-0 [&>*]:mt-0">{write}</div>
      </div>

      {others.length > 0 && (
        <>
          <p className="mt-10 mb-4 text-sm font-semibold text-ink">What customers say about our other products</p>
          <ul className="grid gap-4 md:grid-cols-3">
            {others.map((r) => (
              <li key={r.id} className="flex flex-col rounded-3xl border border-line bg-surface p-5">
                <Stars n={r.rating} />
                {r.title && <p className="mt-3 font-semibold text-ink">{r.title}</p>}
                <p className="mt-1.5 line-clamp-4 text-[15px] leading-relaxed text-ink-muted">{r.body}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">
                    {r.name}
                    {r.city ? `, ${r.city}` : ""}
                  </span>
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 text-co-success">
                      <BadgeCheck className="size-3.5" /> Verified buyer
                    </span>
                  )}
                </div>
                <Link href={`/products/${r.productHandle}`} className="mt-2 text-xs font-semibold text-forest underline-offset-2 hover:underline">
                  on {shortTitle(r.productTitle)} →
                </Link>
              </li>
            ))}
          </ul>
        </>
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

function ReviewsBlock({
  reviews,
  rating,
  count,
  write,
  others,
  productTitle,
}: {
  reviews: PublicReview[];
  rating?: number;
  count?: number;
  write: React.ReactNode;
  others: PublicReview[];
  productTitle: string;
}) {
  if (!reviews.length) return <EmptyReviews others={others} productTitle={productTitle} write={write} />;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
      <div className="rounded-3xl bg-forest p-5 text-white sm:p-6 lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)]">
        <p className="hidden text-lg font-semibold text-white lg:block">Overall rating</p>
        {count ? (
          // Phones: score on the left, bars on the right (one compact block). Desktop: stacked.
          <div className="grid grid-cols-[auto_1fr] items-center gap-5 lg:block">
            <div>
              <p className="text-5xl font-extrabold tabular-nums lg:mt-4">{rating?.toFixed(1)}</p>
              <Stars n={Math.round(rating ?? 0)} className="mt-2" />
              <p className="mt-1 text-sm text-white/70">
                {count} review{count === 1 ? "" : "s"}
              </p>
            </div>
            <ul className="space-y-1.5 lg:mt-5">
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
          </div>
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
