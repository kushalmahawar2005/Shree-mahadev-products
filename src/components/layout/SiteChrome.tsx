import { CartDrawerLazy } from "@/components/cart/CartDrawerLazy";
import { getCollections, getProducts, type Product } from "@/lib/commerce";
import { oilShelfOrder } from "@/data/products";
import { mainNav } from "@/data/site";
import { AnnouncementBar } from "./AnnouncementBar";
import { Header } from "./Header";
import type { MenuProduct } from "./MegaMenu";

const toMenu = (p: Product): MenuProduct => ({
  handle: p.handle,
  title: p.title,
  titleHi: p.titleHi,
  swatch: p.swatch,
  image: p.images[0]?.url,
  from: p.priceRange.min.amount || undefined,
  collections: (p as Product & { collections?: string[] }).collections ?? [],
});

/** Server wrapper: loads cached catalog bits the client header + cart need. */
export async function SiteHeader() {
  const [oils, honey, sweeteners, best, all, collections] = await Promise.all([
    getProducts({ collection: "wood-pressed-oils" }),
    getProducts({ collection: "raw-honey" }),
    getProducts({ collection: "natural-sweeteners" }),
    getProducts({ collection: "bestsellers", first: 4 }),
    getProducts(),
    getCollections(),
  ]);
  const orderedOils = [...oils].sort((a, b) => idx(a.handle) - idx(b.handle));
  const visible = collections.filter((c) => c.inMenu).sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0));
  const baseNav = mainNav.filter((item) => !item.href.startsWith("/collections/"));
  const collectionNav = visible.map((c) => ({
    label: c.title,
    href: `/collections/${c.handle}`,
    ...(c.handle === "wood-pressed-oils" ? { menu: "oils" as const } : {}),
    ...(c.handle === "raw-honey" ? { menu: "honey" as const } : {}),
    ...(c.handle === "natural-sweeteners" ? { menu: "sweeteners" as const } : {}),
    ...(c.handle === "bestsellers" ? { icon: "bestseller" as const } : {}),
  }));
  const nav = [baseNav[0], baseNav[1], ...collectionNav, ...baseNav.slice(2)];
  return (
    <>
      <Header
        announcement={<AnnouncementBar />}
        menus={{
          oils: orderedOils.map(toMenu),
          honey: honey.map(toMenu),
          sweeteners: sweeteners.map(toMenu),
        }}
        nav={nav}
        collections={visible.map((c) => ({ handle: c.handle, title: c.title }))}
        recommended={best.map(toMenu)}
        allProducts={all.map(toMenu)}
      />
    </>
  );
}

function idx(h: string) {
  const i = oilShelfOrder.indexOf(h);
  return i === -1 ? 999 : i;
}

export async function SiteCartDrawer() {
  const [upsells, catalog] = await Promise.all([getProducts({ collection: "bestsellers", first: 4 }), getProducts()]);
  return <CartDrawerLazy upsells={upsells} catalog={catalog} />;
}
