import { Reels, type ReelItem } from "@/components/home/Reels";
import { getHomeVideos } from "@/lib/home-videos";
import { getStoreSettings } from "@/lib/server/store-settings";
import { Hero } from "@/components/home/Hero";
import { toPickProduct } from "@/components/home/pickProduct";
import {
  BeyondOils,
  BrandFilmSection,
  PromoStrip,
  ProofCards,
  ShopByUseCarousel,
  Spotlight,
  TopPicks,
} from "@/components/home/PicksSections";
import { RasoiKit, type KitItem } from "@/components/home/RasoiKit";
import { categoryTiles, topPicks } from "@/data/home";
import { shopByUse } from "@/data/site";
import { getProducts } from "@/lib/commerce";
import { getFeaturedReviews } from "@/lib/server/reviews";
import { FeaturedReviewCards } from "@/components/reviews/ReviewList";
import { FeaturedCollections, type CategoryTile } from "@/components/home/FeaturedCollections";

/** Temporarily hidden sections (listed in HIDDEN.md). Flip to true to show again. */
const SHOW_RASOI_KIT = false;
const SHOW_BEYOND_OILS = false;

/**
 * Homepage. Below the hero the section order and layout follow twobrothersindiashop.com:
 * Top Picks → promo strip → brand film → proof → shop by use → spotlight + endorsements → beyond.
 */
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

  const useTabs = shopByUse.map((u) => ({
    label: u.label,
    viewAll: `/shop?use=${u.tag}`,
    products: buyableFirst(all.filter((p) => p.tags.includes(u.tag))).map(
      toPickProduct,
    ),
  }));

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
  const reelItems: ReelItem[] = videos.reels.map((r) => {
    const p = r.productHandle
      ? all.find((x) => x.handle === r.productHandle)
      : undefined;
    return {
      id: r.id,
      videoUrl: r.videoUrl,
      caption: r.caption,
      instagramUrl: r.instagramUrl,
      product: p ? { handle: p.handle, title: p.title } : null,
    };
  });

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
      href: items.length ? `/collections/${c.collection}` : undefined,
      count: items.length || undefined,
      images: items.map((p) => p.images[0]?.url).filter((u): u is string => !!u).slice(0, 3),
    };
  });

  return (
    <>
      <Hero />
      <TopPicks tabs={pickTabs} />
      <PromoStrip />
      <FeaturedCollections tiles={tiles} />
      {reelItems.length > 0 && (
        <Reels title="Straight from the ghani" reels={reelItems} />
      )}
      <BrandFilmSection youtube={videos.youtube} />
      <ProofCards />
      <ShopByUseCarousel tabs={useTabs} />
      <Spotlight
        products={all}
        fadeTo={SHOW_BEYOND_OILS ? "#FCF2E5" : "#FFFFFF"}
      />
      <FeaturedReviewCards reviews={reviews} />
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
    </>
  );
}
