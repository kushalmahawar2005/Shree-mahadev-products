import { thumbUrl } from "@/lib/image-loader";
import { fallbackFaqs } from "@/data/pdp-faqs";
import { Marquee } from "@/components/shadcn/marquee";
import { inlineRichText, richTextToHtml } from "@/lib/utils/rich-text";
import { VariantImageProvider } from "@/components/product/VariantImage";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Ban, BadgeCheck, CircleCheckBig, FlaskConicalOff, Heart, Home, Leaf, ShieldCheck, Sprout, Star } from "lucide-react";
import { KolhuIcon } from "@/components/icons/KolhuIcon";
import {
  Award as LuAward,
  Filter as LuFilter,
  FlaskConical as LuFlaskConical,
  Leaf as LuLeaf,
  MapPin as LuMapPin,
  ThermometerSnowflake as LuThermometerSnowflake,
} from "lucide-react";
import { Banknote, FlaskConical, Lock, Truck } from "@/components/icons/duo";
import { DetailsTabs, type DetailTab } from "@/components/product/DetailsTabs";
import { SectionHeader, sectionClass } from "@/components/ui/SectionHeader";
import { GhaniVsRefined } from "@/components/product/GhaniVsRefined";
import { Reveal } from "@/components/motion/Reveal";
import { BAND, Band, HomeChecks, StoryBand } from "@/components/product/PdpStory";
import { MethodSteps } from "@/components/product/MethodSteps";
import type { Art } from "@/data/brand-art";
import { pdpArt } from "@/data/pdp-art";
import { BoughtTogether, type BundleItem } from "@/components/product/BoughtTogether";
import { fullAddress, site } from "@/data/site";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { Gallery } from "@/components/product/Gallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { RecordView } from "@/components/product/RecentlyViewed";
import { Reels, type ReelItem } from "@/components/home/Reels";
import { getHomeVideos } from "@/lib/home-videos";
import { getPdpStories } from "@/lib/server/pdp-story";
import { parseReelLink, reelEmbedSrc, reelLinkPoster } from "@/lib/reel-link";
import { ReviewList } from "@/components/product/ReviewList";
import { defaultVariant } from "@/lib/commerce/default-variant";
import { WriteReview } from "@/components/reviews/WriteReview";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getProduct, getProducts, type Product } from "@/lib/commerce";
import { getOtherProductReviews, getProductReviews, type PublicReview } from "@/lib/server/reviews";
import { getStoreSettings } from "@/lib/server/store-settings";
import { formatMoney } from "@/lib/utils/money";
import { hasTodo, noTodo } from "@/lib/utils/no-todo";
import { breadcrumbJsonLd, jsonLdString, pageMetadata, productJsonLd } from "@/lib/utils/seo";
import { cn } from "@/lib/utils/cn";
import { siteVideo } from "@/lib/site-videos";
import { MIN_REVIEWS_FOR_RATING } from "@/lib/utils/reviews";


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

/** Short process reels shown as the last gallery slide on oil pages. */
const REELS = {
  ghani: { ...siteVideo("reels/ghani-pour", 480), label: "Fresh oil pouring from our ghani" },
  coconut: { ...siteVideo("reels/coconut-in", 480), label: "Coconut going into our ghani" },
};

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

export default async function ProductPage({ params }: PageProps<"/products/[handle]">) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const [related, reviews, settings] = await Promise.all([pairsWellWith(product), getProductReviews(handle), getStoreSettings()]);
  // No reviews here yet: show real, approved reviews of our other products instead of an empty box.
  const otherReviews = reviews.length ? [] : await getOtherProductReviews(product.handle);
  const cat = CATEGORY[product.category as keyof typeof CATEGORY] ?? CATEGORY.oil;
  const isOil = product.category === "oil";
  const isHoney = product.category === "honey";

  const sizes = product.variants.filter((v) => v.price.amount > 0);
  // "Complete your kitchen": this product + one more from the same shelf + one from another shelf.
  const catalog = (await getProducts()).filter((p) => p.handle !== product.handle && p.priceRange.min.amount > 0);
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
  const [stories, siteVideos] = await Promise.all([getPdpStories(), getHomeVideos()]);
  const story = stories[product.category] ?? {};
  // Reels come from the admin Reels page (ticked for this category); our ghani clips are seeded there.
  const placed = siteVideos.reels.filter((r) => r.placements.includes(product.category));
  const reelSource = placed.map((r) => ({ video: r.videoUrl || undefined, link: r.videoUrl ? undefined : r.instagramUrl ?? undefined, caption: r.caption, cover: undefined as string | undefined }));
  // Our own ghani clips, each tagged with this product so "Add to cart" in the viewer adds it.
  const onSale = product.variants.filter((v) => v.availableForSale);
  const dv = defaultVariant(product);
  // This product's own videos (admin Reels → "Its product page" + tagged with this product).
  const ownVideos = siteVideos.reels
    .filter((r) => r.placements.includes("product") && r.productHandle === product.handle)
    .map((r) => ({ video: r.videoUrl || undefined, link: r.videoUrl ? undefined : r.instagramUrl ?? undefined, caption: r.caption, cover: undefined as string | undefined }));
  const toItems = (list: typeof reelSource, idBase: number): ReelItem[] => list.flatMap((r, n) => {
    const parsed = r.link ? parseReelLink(r.link) : null;
    const link = parsed?.ok ? parsed.link : null;
    if (!link && !r.video) return [];
    return [{
    id: -(idBase + n + 1),
    videoUrl: r.video ?? "",
    caption: r.caption,
    instagramUrl: null,
    embedUrl: link ? reelEmbedSrc(link) : null,
    posterUrl: link ? r.cover || reelLinkPoster(link) : null,
    product: {
      handle: product.handle,
      title: product.title,
      image: product.images[0]?.url,
      price: dv?.price.amount,
      variantId: dv?.id,
      variantTitle: dv?.title,
      variants: onSale.map((x) => ({ id: x.id, title: x.title, price: x.price.amount })),
    },
    }];
  });
  const reelItems = toItems(reelSource, 0);
  const productVideoItems = toItems(ownVideos, 1000);
  // Purity marquee in the buy column: real process facts only (no health claims).
  // Purity marquee in the buy column: real process facts only (no health claims).
  // Solid green badges with white line icons (lucide), like a certification row.
  const purity = isOil
    ? [
        { I: KolhuIcon, t: "Kolhu wood pressed", s: "Slow lakdi kachi ghani · Low RPM" },
        { I: LuThermometerSnowflake, t: "No external heat", s: "Oil stays cool · room temperature" },
        { I: LuFilter, t: "No filter", s: "Cloth filter with gravity sedimentation (10-day process)" },
        { I: LuFlaskConical, t: "Lab tested", s: "NABL approved lab" },
      ]
    : [
        { I: LuLeaf, t: "Nothing added", s: isHoney ? "No sugar syrup" : "No bleaching" },
        { I: LuFlaskConical, t: "Lab tested", s: "NABL approved lab" },
        { I: LuAward, t: "FSSAI licensed", s: `Lic. ${site.fssai}` },
        { I: LuMapPin, t: "Packed in Bijainagar", s: "By our family" },
      ];
  // Highlights come only from the admin "Highlights" list. Usage (what it's best for) lives in How to use, not here.
  const highlights = [...new Set(product.benefits.filter((x) => !!x?.trim()))];
  // Desktop title: two lines for oils ("<Name>, Wood-Pressed," / "Gravity-Filtered"); the longer first line sets the size.
  const titleLineLength = (shortTitle(product.title) + (isOil ? ", Wood-Pressed," : "")).length;
  const tagPill = isOil ? "Traditional method · Lakdi kachi ghani" : isHoney ? (product.tags.includes("bestseller") ? "Bestseller" : "Raw honey") : "Naturally Sweet, Traditionally Made";

  const description = noTodo(product.descriptionHtml) ?? noTodo(product.shortDescription);
  // A shelf life with an open TODO is not confirmed yet: don't state it.
  const shelfLife = hasTodo(product.shelfLife) ? undefined : product.shelfLife;
  const howToUse = noTodo(product.howToUse);
  const tabs: DetailTab[] = [
    // Same order as the admin form: Description → Benefits → Ingredients → How to use.
    // No "How it's made" row (client, 20 Nov): the illustrated process steps below the buy box cover it.
    description
      ? {
          id: "about",
          title: "About",
          body: <div className="prose-sm-custom max-w-none text-ink" dangerouslySetInnerHTML={{ __html: richTextToHtml(description) }} />,
        }
      : null,
    // Benefits and Ingredients come only from the admin form (same text there and here); empty = row hidden.
    noTodo(product.benefitsText)
      ? {
          id: "benefits",
          title: "Benefits",
          body: (
            <ul className="list-disc space-y-1.5 pl-5 [&_strong]:text-ink">
              {product.benefitsText!.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).map((l) => (
                <li key={l} dangerouslySetInnerHTML={{ __html: inlineRichText(l) }} />
              ))}
            </ul>
          ),
        }
      : null,
    noTodo(product.ingredients)
      ? { id: "ingredients", title: "Ingredients", body: <div className="space-y-3 [&_strong]:text-ink" dangerouslySetInnerHTML={{ __html: richTextToHtml(product.ingredients!) }} /> }
      : null,
    howToUse
      ? {
          id: "use",
          title: "How to use",
          body: (
            <div className="space-y-3">
              {howToUse && <div dangerouslySetInnerHTML={{ __html: richTextToHtml(howToUse) }} />}
            </div>
          ),
        }
      : null,
    product.labReportUrl
      ? {
          id: "lab",
          title: "Lab report",
          body: (
            <a href={product.labReportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-forest underline underline-offset-2">
              <FlaskConical className="size-5" /> View this batch&apos;s lab report (PDF)
            </a>
          ),
        }
      : null,
    {
      id: "info",
      title: "Product info",
      body: (
        // Legal Metrology (e-commerce) declaration. Rows the client hasn't confirmed yet stay hidden.
        <dl>
          {(
            [
              ["Product name", product.title],
              ["Net quantity", sizes.map((v) => v.title).join(" · ")],
              ["MRP (incl. of all taxes)", sizes.map((v) => `${v.title} ${formatMoney((v.compareAtPrice ?? v.price).amount)}`).join(" · ")],
              ["Storage", isOil ? "Store in a cool, dry place away from direct sunlight." : "Store in a cool, dry place. Keep the lid tightly closed."],
              ["Best before", shelfLife],
              ["Country of origin", "India"],
              ["Manufactured & packed by", `${site.name}, ${fullAddress}`],
              ["FSSAI Lic. No.", site.fssai],
              ["Customer care", site.email],
            ] as [string, string | undefined][]
          )
            .filter((row): row is [string, string] => !!row[1])
            .map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 border-b border-forest/25 py-2 last:border-0 sm:flex-row sm:gap-4">
                <dt className="w-40 shrink-0 text-sm text-ink-muted">{k}</dt>
                <dd className="text-sm text-ink">{v}</dd>
              </div>
            ))}
        </dl>
      ),
    },
  ].filter(Boolean) as DetailTab[];
  // The product's own FAQs (admin) first, then category FAQs to fill up to five (no repeated questions).
  const ownFaqs = (product.faqs ?? []).filter((f) => !hasTodo(f.q) && !hasTodo(f.a));
  const faqs = [...ownFaqs, ...fallbackFaqs(product.category).filter((f) => !ownFaqs.some((o) => o.q.trim().toLowerCase() === f.q.toLowerCase()))].slice(0, Math.max(5, ownFaqs.length));
  const trust = [
    { I: Truck, t: "Free delivery", s: `above ${formatMoney(settings.shipping.freeShippingThreshold)}` },
    ...(settings.shipping.codEnabled ? [{ I: Banknote, t: "Cash on delivery", s: "pay at your door" }] : []),
    { I: Lock, t: "Secure payments", s: "UPI · cards · netbanking" },
  ];
  const reels = [...productVideoItems, ...reelItems];

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
            ...(faqs.length
              ? [
                  {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
                  },
                ]
              : []),
          ]),
        }}
      />

      <div className="mx-auto max-w-[1360px] px-4 pt-4 pb-12 md:px-8 md:pt-6 md:pb-16">
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
          {/* Zone 1: sticky gallery (stage + thumbnail rail) | buy column. One column below lg. */}
          <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12 xl:gap-16 [&>*]:min-w-0">
            <div className="relative lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)] lg:self-start">
                  {/* Promise strip on top of the photo: a slow marquee of what is NOT in the bottle. */}
                  <div className="pointer-events-none absolute inset-x-px top-px z-10 overflow-hidden rounded-t-[27px] border-b border-line bg-white py-2">
                    <Marquee repeat={4} className="p-0 [--duration:26s] [--gap:0rem]">
                      {(
                      [
                        [Sprout, "No additives"],
                        [Ban, "No preservatives"],
                        ...(isOil ? ([[FlaskConicalOff, "No hexane"]] as const) : []),
                        [ShieldCheck, "No chemicals"],
                        [CircleCheckBig, "100% Natural"],
                      ] as const
                    ).map(([Icon, t]) => (
                      <span key={t} className="flex items-center gap-2 pr-5 text-[11px] font-bold tracking-[0.12em] whitespace-nowrap text-forest uppercase sm:text-xs">
                        <Icon className="size-4 text-forest" strokeWidth={2} />
                        <span className="text-shine-forest">{t}</span>
                        <span aria-hidden className="ml-4 size-1.5 rounded-full bg-co-accent" />
                      </span>
                    ))}
                    </Marquee>
                  </div>
              <Gallery
                images={product.images}
                title={product.title}
                swatch={product.swatch}
                video={isOil ? (product.handle.includes("coconut") ? REELS.coconut : REELS.ghani) : undefined}
              />
            </div>

            <div>
              {/* A. Buy box */}
              <section aria-label="Buy" className="@container lg:-mt-2">
                <div className="@container">
                {(
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {tagPill && <p className="inline-flex rounded-full bg-co-accent-soft px-3 py-1 text-xs font-semibold text-co-accent-ink">{tagPill}</p>}
                    {/* Two Brothers-style outlined pill: wood-pressed oil is never solvent (hexane) extracted. */}
                    {/* Outlined promise pill per category: oils hexane-free, honey bee farming, sweeteners sulphur-free. */}
                    <p className={cn("inline-flex rounded-full border-[1.5px] border-forest px-3 py-[3px] text-[11px] font-bold text-forest", isHoney ? "text-xs tracking-wide" : "tracking-[0.12em] uppercase")}>
                      {isOil ? "Hexane-free" : isHoney ? "Bee farming" : "Sulphur-free"}
                    </p>
                    {/* Families pill: overlapping icon badges (no stock faces) + count, in one capsule. */}
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-0.5 pr-3 pl-0.5 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
                      <span aria-hidden className="flex -space-x-1.5">
                        {([
                          [Home, "bg-forest text-white"],
                          [Heart, "bg-[#c9921f] text-white"],
                          [Leaf, "bg-co-accent-soft text-forest"],
                        ] as const).map(([Icon, cls], i) => (
                          <span key={i} className={`grid size-[22px] place-items-center rounded-full ring-2 ring-white ${cls}`}>
                            <Icon className="size-3" strokeWidth={2.4} />
                          </span>
                        ))}
                      </span>
                      <span className="text-shine-forest text-xs font-semibold">
                        <b className="text-[13px] font-extrabold">500+</b> Happy Families
                      </span>
                    </p>
                  </div>
                )}
                <h1
                  className="font-display text-[min(26px,7cqi)] leading-[1.15] tracking-[-0.02em] text-forest sm:text-[34px] lg:text-[min(40px,var(--title-fit))]"
                  // Desktop: the font grows to fill the buy column with the first line (≈0.46em per character
                  // for this face, plus a small margin), up to 40px.
                  style={{ "--title-fit": `${(100 / (0.52 * titleLineLength)).toFixed(2)}cqi` } as React.CSSProperties}
                >
                  {shortTitle(product.title)}
                  {isOil && (
                    <>
                      , <span className="whitespace-nowrap">Wood-Pressed,</span>
                      <br className="max-lg:hidden" />
                      <span className="whitespace-nowrap max-lg:ml-[0.25em]">Gravity-Filtered</span>
                    </>
                  )}
                </h1>
                {/* Hindi name + rating on one line, short description below; the families seal sits in the space on the right. */}
                <div className="mt-1">
                  <div className="min-w-0 max-w-xl">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {product.titleHi && (
                        <span className="font-hindi text-lg whitespace-nowrap text-co-accent-ink" lang="hi">
                          {product.titleHi}
                        </span>
                      )}
                      <a href="#reviews" className="flex items-center gap-2 text-sm text-ink-muted hover:text-forest">
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
                    </div>
                    {noTodo(product.shortDescription) && (
                      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink" dangerouslySetInnerHTML={{ __html: inlineRichText(product.shortDescription) }} />
                    )}
                  </div>
                </div>
                </div>
                <div className="mt-2.5 border-t border-line pt-4">
                  <ProductPurchase
                    handle={product.handle}
                    title={product.title}
                    variants={product.variants}
                    defaultSize={product.defaultSize}
                    lowStock={settings.lowStockThreshold}
                    isOil={isOil}
                    image={product.images[0] ? thumbUrl(product.images[0].url, 44) : undefined}
                    footer={
                      <>
                      {/* The only place free delivery, COD and secure payments are stated on this page. */}
                      <ul className="mt-4 grid auto-cols-fr grid-flow-col divide-x divide-line rounded-2xl border border-line bg-surface">
                        {trust.map(({ I, t, s }) => (
                          <li key={t} className="flex min-w-0 flex-col items-center gap-1 px-2 py-3 text-center sm:flex-row sm:gap-2 sm:px-3 sm:text-left">
                            <I className="size-6 shrink-0" />
                            <span className="min-w-0 leading-tight">
                              <span className="block text-[13px] font-semibold text-ink">{t}</span>
                              <span className="block text-[11px] text-ink-muted">{s}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      </>
                    }
                  />
                </div>
              </section>

              {/* Purity proof: every process fact visible at once (a marquee hid the later ones). */}
              <section aria-label="How you know it's pure" className="mt-6">
                {/* Two Brothers style: one outlined box, facts side by side with thin dividers (2 × 2 on phones). */}
                <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border-[1.5px] border-forest/70 bg-forest/70 sm:grid-cols-4">
                  {purity.map(({ I, t, s }) => (
                    <li key={t} className="flex flex-col items-center justify-center gap-1.5 bg-page px-2 py-4 text-center">
                      <I className="size-8 text-forest" strokeWidth={1.6} />
                      <b className="text-[13.5px] leading-tight font-bold text-forest">{t}</b>
                      <span className="text-[12px] leading-snug font-semibold text-ink/70">{s}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* B. Highlights */}
              {highlights.length > 0 && (
                <section aria-labelledby="hl-h" className="mt-6 rounded-2xl border border-line bg-surface px-5 pt-4 pb-2.5">
                  <h2 id="hl-h" className="text-base font-bold text-ink">
                    Highlights
                  </h2>
                  <ul className="mt-3 gap-x-6 text-[15px] text-ink sm:columns-2">
                    {highlights.map((h) => (
                      <li key={h} className="mb-2.5 flex break-inside-avoid items-start gap-2.5">
                        <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-[#2f9e5b]" strokeWidth={2} aria-hidden />
                        <span dangerouslySetInnerHTML={{ __html: inlineRichText(h) }} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* C. Details */}
              {/* The open panel turns light green, like the selected size card. */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface" id="details">
                <DetailsTabs
                  tabs={tabs}
                  className="[&>*:last-child]:border-b-0"
                  itemClassName="border-line px-5 transition-colors duration-200 data-[state=open]:bg-[#e4f4dc]"
                />
              </div>
            </div>
          </div>
        </VariantImageProvider>
      </div>

      {/* Zone 2: full-width story bands, each on its own tint. */}
      {[
        reels.length > 0 ? band("forest", undefined,
          <Reels key="reels" align="left" dark eyebrow="घाणी से सीधा" title="Our ghani, in action" subtitle="Real clips from our ghani in Bijainagar. Tap any reel to watch." reels={reels} />,
        ) : null,
        story.method ? band("ivory", pdpArt.method, <MethodSteps key="method" {...story.method} />) : null,
        isOil ? band("green", pdpArt.compare,
          <section key="cmp" className={sectionClass} aria-labelledby="cmp-h">
            <Reveal>
              <SectionHeader id="cmp-h" eyebrow="कच्ची घाणी क्यों" title="Kachi ghani vs refined" subtitle="Same seed, two very different oils." />
              <GhaniVsRefined />
            </Reveal>
          </section>,
        ) : null,
        story.checks ? band("mustard", pdpArt.checks, <HomeChecks key="checks" {...story.checks} />) : null,
        band("ivory", pdpArt.reviews,
          <section key="reviews" id="reviews" className={cn(sectionClass, "scroll-mt-32")} aria-labelledby="rev-h">
            <SectionHeader id="rev-h" eyebrow="आपकी राय" title="Customer reviews" />
            <ReviewsBlock others={otherReviews} productTitle={shortTitle(product.title)} reviews={reviews} rating={product.rating} count={product.reviewCount} write={<WriteReview productHandle={product.handle} productTitle={product.title} category={product.category} />} />
          </section>,
        ),
        faqs.length > 0 ? band("mustard", undefined,
          <section key="faqs" className={cn(sectionClass, "max-w-[800px]")} aria-labelledby="faq-h">
            <SectionHeader id="faq-h" eyebrow="सवाल-जवाब" title="Frequently asked questions" />
            <DetailsTabs tabs={faqs.map((f, n) => ({ id: `faq-${n}`, title: f.q, body: <p>{f.a}</p> }))} />
          </section>,
        ) : null,
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
        band("mustard", pdpArt.story, "top-0 right-0 hidden w-[280px] md:block", <StoryBand key="story" isOil={isOil} />),
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

/** One PDP band: its tint, its own corner ornament and the section inside. */
const band = (tone: keyof typeof BAND, art: Art | undefined, ...rest: [React.ReactNode] | [string, React.ReactNode]) =>
  rest.length === 2 ? { tone, art, artClass: rest[0], node: rest[1] } : { tone, art, artClass: undefined, node: rest[0] };

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
