import type { Metadata } from "next";
import { pageMetadata } from "@/lib/utils/seo";
import { ReelStories, Reels, type ReelItem } from "@/components/home/Reels";
import { getHomeVideos } from "@/lib/home-videos";
import { getStoreSettings } from "@/lib/server/store-settings";
import { Hero } from "@/components/home/Hero";
import { toPickProduct } from "@/components/home/pickProduct";
import {
  BeyondOils,
  BrandFilmSection,
  Spotlight,
  TopPicks,
} from "@/components/home/PicksSections";
import { RasoiKit, type KitItem } from "@/components/home/RasoiKit";
import { categoryTiles, promoStrip, proof, shopByUseScenes, topPicks } from "@/data/home";
import { RefinedVsGhani } from "@/components/home/RefinedVsGhani";
import { AppBanner } from "@/components/pwa/AppBanner";
import { ProofSection } from "@/components/home/ProofSection";
import { ShopByUse } from "@/components/home/ShopByUse";
import { ReviewsWall } from "@/components/home/ReviewsWall";
import { ServiceHighlights } from "@/components/home/ServiceHighlights";
import { WhyChooseOil } from "@/components/home/WhyChooseOil";
import { shopByUse } from "@/data/site";
import { getProducts } from "@/lib/commerce";
import { getFeaturedReviews } from "@/lib/server/reviews";
import { FeaturedCollections, type CategoryTile } from "@/components/home/FeaturedCollections";
import { defaultVariant } from "@/lib/commerce/default-variant";
import { parseReelLink, reelEmbedSrc, reelLinkPoster } from "@/lib/reel-link";


/** Temporarily hidden sections (listed in HIDDEN.md). Flip to true to show again. */
const SHOW_RASOI_KIT = false;
const SHOW_BEYOND_OILS = false;

/**
 * Homepage. Below the hero the section order and layout follow twobrothersindiashop.com:
 * Top Picks → promo strip → brand film → proof → shop by use → spotlight + endorsements → beyond.
 */
/** Home owns the "/" canonical (it used to come from the layout and leak onto every page). */
export const metadata: Metadata = pageMetadata({
  // What people search first; the layout template adds " | Swadeshi Mahadev Products".
  title: "Wood-Pressed Kachi Ghani Oils, Raw Honey & Jaggery",
  description:
    "Buy pure wood-pressed (kachi ghani) mustard, groundnut, coconut and sesame oils, raw honey and jaggery from Rajasthan. Lab tested, FSSAI licensed, COD available.",
  path: "/",
});

export default async function HomePage() {
  const [all, ...pickLists] = await Promise.all([
    getProducts(),
    ...topPicks.tabs.map((t) =>
      getProducts({ collection: t.source.collection }),
    ),
  ]);

  const pickTabs = topPicks.tabs.map((t, i) => ({
    label: t.label,
    viewAll: t.viewAll,
    products: pickLists[i].map(toPickProduct),
  }));


  // Products with a real price first, so the carousel opens on buyable items.
  const buyableFirst = <
    T extends { variants: { availableForSale: boolean }[] },
  >(
    list: T[],
  ) =>
    [...list].sort(
      (a, b) =>
        Number(b.variants.some((v) => v.availableForSale)) -
        Number(a.variants.some((v) => v.availableForSale)),
    );

  const useTabs = shopByUse.map((u) => {
    const { order = [], ...scene } = shopByUseScenes[u.tag];
    const rank = (h: string) => (order.includes(h) ? order.indexOf(h) : order.length);
    // Client's order first, then the rest (buyable first, stable).
    const products = buyableFirst(all.filter((p) => p.tags.includes(u.tag))).sort((a, b) => rank(a.handle) - rank(b.handle));

    return {
      key: u.tag,
      label: u.label,
      labelHi: u.labelHi,
      note: u.note,
      tip: u.tip,
      scene,
      viewAll: `/shop?use=${u.tag}`,
      products: products.map(toPickProduct),
    };
  });

  // Rasoi Starter Kit (AGENTS.md §5 combos). TODO(client): confirm contents + bundle price.
  const kitSpec = [
    { handle: "yellow-mustard-oil", size: "1 L" },
    { handle: "groundnut-oil", size: "1 L" },
    { handle: "black-sesame-oil", size: "500 ml" },
  ];
  const kitItems: KitItem[] = kitSpec.map(({ handle, size }) => {
    const p = all.find((x) => x.handle === handle);
    const v = p?.variants.find((x) => x.title === size);
    return {
      name: p?.title.replace(/^(Wood|Cold)-Pressed /, "") ?? handle,
      size,
      swatch: p?.swatch,
      image: p?.images[0],
      variantId: v?.availableForSale ? v.id : undefined,
      price: v?.availableForSale ? v.price.amount : undefined,
      compareAt: v?.compareAtPrice?.amount,
    };
  });

  const [videos, settings, reviews] = await Promise.all([
    getHomeVideos(),
    getStoreSettings(),
    getFeaturedReviews(),
  ]);
  // Admin → Reels is the only source (our own ghani clips are seeded there as reels, migration 050).
  const homeReels = videos.reels.filter((r) => r.placements.includes("home"));
  const reelSource = homeReels;
  // A link-only row whose link no longer plays here (old Instagram links) is skipped.
  const reelItems: ReelItem[] = reelSource.filter((r) => r.videoUrl || (r.instagramUrl && parseReelLink(r.instagramUrl).ok)).map((r) => {
    const p = r.productHandle
      ? all.find((x) => x.handle === r.productHandle)
      : undefined;
    // Link-only reel (no uploaded file): play YouTube's player inside our viewer.
    const parsed = !r.videoUrl && r.instagramUrl ? parseReelLink(r.instagramUrl) : null;
    const link = parsed?.ok ? parsed.link : null;
    return {
      id: r.id,
      videoUrl: r.videoUrl,
      caption: r.caption,
      instagramUrl: link ? null : r.instagramUrl,
      embedUrl: link ? reelEmbedSrc(link) : null,
      posterUrl: link ? reelLinkPoster(link) : null,
      product: p
        ? (() => {
            const v = defaultVariant(p);
            return {
              handle: p.handle,
              title: p.title,
              image: p.images[0]?.url,
              price: v?.price.amount,
              variantId: v?.id,
              variantTitle: v?.title,
              // Sizes for the reel viewer's size picker (on sale only).
              variants: p.variants.filter((x) => x.availableForSale).map((x) => ({ id: x.id, title: x.title, price: x.price.amount })),
            };
          })()
        : null,
    };
  });

  // The film showcase takes two reels; the Reels section shows the rest, so no clip appears twice.
  const filmReels = reelItems.length >= 4 ? reelItems.slice(2, 4) : reelItems.slice(0, Math.min(2, reelItems.length - 1));
  // TODO(client): once 6+ reels are uploaded in /admin/videos, show only the ones the film doesn't use:
  //   reelItems.filter((r) => !filmReels.includes(r)). Until then the section shows every reel (owner, 2026-11-12).
  const sectionReels = reelItems.filter((r) => !filmReels.includes(r)).length >= 4 ? reelItems.filter((r) => !filmReels.includes(r)) : reelItems;

  // Six client categories: products + photos come from the matching collection; empty = coming soon.
  const inCollection = (h: string) => all.filter((p) => ((p as typeof p & { collections?: string[] }).collections ?? []).includes(h));
  const tiles: CategoryTile[] = categoryTiles.map((c) => {
    const items = c.collection ? inCollection(c.collection) : [];
    return {
      key: c.key,
      title: c.title,
      titleHi: c.titleHi,
      blurb: c.blurb,
      unit: c.unit,
      span: c.span,
      tone: c.tone,
      cover: "cover" in c ? c.cover : undefined,
      scene: "scene" in c ? c.scene : undefined,
      stage: "stage" in c ? c.stage : undefined,
      href: items.length ? `/collections/${c.collection}` : undefined,
      count: items.length || undefined,
      // Each category has a composed photo, sized independently from the live product count.
      images: [],
    };
  });

  return (
    <>
      {/* Hero slides are images with optional h2 copy, so the page's one H1 lives here for SEO / screen readers. */}
      <h1 className="sr-only">Swadeshi Mahadev Products: wood-pressed kachi ghani oils, raw honey and desi jaggery from Bijainagar, Rajasthan</h1>
      {/* Phones: reels as Instagram-style stories right above the hero. */}
      <ReelStories reels={reelItems} />
      <Hero />
      <TopPicks tabs={pickTabs} />
      <AppBanner placement="home" />
      <RefinedVsGhani cta={promoStrip.cta} />
      <FeaturedCollections tiles={tiles} />
      <BrandFilmSection youtube={videos.youtube} reels={filmReels} />
      <ShopByUse tabs={useTabs} />
      <ProofSection reports={[...proof.reports]} fssaiNo={proof.fssaiNo} fssaiValidTill={proof.fssaiValidTill} lab={proof.lab} />
      {sectionReels.length > 0 && <Reels title="Straight from the ghani" reels={sectionReels} hideOnMobile />}
      <WhyChooseOil />
      <Spotlight
        products={all}
        fadeTo="var(--color-page)"
      />
      <ReviewsWall reviews={reviews} />
      {SHOW_BEYOND_OILS && <BeyondOils />}
      {/* Rasoi Kit card, last section before the footer. TODO(client): kit contents + price.
          Hidden for now: see HIDDEN.md. */}
      {SHOW_RASOI_KIT && (
        <RasoiKit
          items={kitItems}
          href="/collections/combos"
          freeShippingThreshold={settings.shipping.freeShippingThreshold}
          codAvailable={settings.shipping.codEnabled}
        />
      )}
      <ServiceHighlights />
    </>
  );
}
