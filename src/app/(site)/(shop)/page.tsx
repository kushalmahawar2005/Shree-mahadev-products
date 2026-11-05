import { Reels, type ReelItem } from "@/components/home/Reels";
import { getHomeVideos } from "@/lib/home-videos";
import { getStoreSettings } from "@/lib/server/store-settings";
import { Hero } from "@/components/home/Hero";
import { toPickProduct } from "@/components/home/pickProduct";
import {
  BeyondOils,
  BrandFilmSection,
  PromoStrip,
  Spotlight,
  TopPicks,
} from "@/components/home/PicksSections";
import { RasoiKit, type KitItem } from "@/components/home/RasoiKit";
import { categoryTiles, proof, topPicks } from "@/data/home";
import { ProofSection } from "@/components/home/ProofSection";
import { ShopByUse } from "@/components/home/ShopByUse";
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
    key: u.tag,
    label: u.label,
    labelHi: u.labelHi,
    note: u.note,
    tip: u.tip,
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
  // Until reels are uploaded in admin, show clips from our own ghani footage.
  const fallbackReels = [
    { id: -1, videoUrl: "/videos/reels/ghani-1.mp4", caption: "Fresh coconut going into the ghani", productHandle: "coconut-oil", instagramUrl: null },
    { id: -2, videoUrl: "/videos/reels/ghani-2.mp4", caption: "Slow pressing, no heat", productHandle: null, instagramUrl: null },
    { id: -3, videoUrl: "/videos/reels/oil-pour.mp4", caption: "Golden oil, straight from the press", productHandle: "yellow-mustard-oil", instagramUrl: null },
    { id: -4, videoUrl: "/videos/reels/ghani-3.mp4", caption: "Settled, filtered, bottled by hand", productHandle: null, instagramUrl: null },
  ];
  const reelSource = videos.reels.length ? videos.reels : fallbackReels;
  const reelItems: ReelItem[] = reelSource.map((r) => {
    const p = r.productHandle
      ? all.find((x) => x.handle === r.productHandle)
      : undefined;
    return {
      id: r.id,
      videoUrl: r.videoUrl,
      caption: r.caption,
      instagramUrl: r.instagramUrl,
      product: p
        ? (() => {
            const v = p.variants.find((x) => x.availableForSale);
            return { handle: p.handle, title: p.title, image: p.images[0]?.url, price: v?.price.amount, variantId: v?.id, variantTitle: v?.title };
          })()
        : null,
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
      <BrandFilmSection youtube={videos.youtube} />
      <ProofSection reports={[...proof.reports]} fssaiNo={proof.fssaiNo} fssaiValidTill={proof.fssaiValidTill} lab={proof.lab} />
      <ShopByUse tabs={useTabs} />
      {reelItems.length > 0 && (
        <Reels title="Straight from the ghani" reels={reelItems} />
      )}
      <Spotlight
        products={all}
        fadeTo="#F5EDDE"
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
