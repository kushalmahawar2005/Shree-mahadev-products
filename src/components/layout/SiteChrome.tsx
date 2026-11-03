import { CartDrawer } from "@/components/cart/CartDrawer";
import { getProducts, type Product } from "@/lib/commerce";
import { collectionDefs } from "@/data/collections";
import { oilShelfOrder } from "@/data/products";
import { Header } from "./Header";
import type { MenuProduct } from "./MegaMenu";

const toMenu = (p: Product): MenuProduct => ({
  handle: p.handle,
  title: p.title,
  titleHi: p.titleHi,
  swatch: p.swatch,
  image: p.images[0]?.url,
  from: p.priceRange.min.amount || undefined,
  collections: collectionDefs.filter((c) => c.match(p)).map((c) => c.handle),
});

/** Server wrapper: loads cached catalog bits the client header + cart need. */
export async function SiteHeader() {
  const [oils, honey, sweeteners, best, all] = await Promise.all([
    getProducts({ collection: "wood-pressed-oils" }),
    getProducts({ collection: "raw-honey" }),
    getProducts({ collection: "natural-sweeteners" }),
    getProducts({ collection: "bestsellers", first: 4 }),
    getProducts(),
  ]);
  const orderedOils = [...oils].sort((a, b) => idx(a.handle) - idx(b.handle));
  return (
    <>
      <Header
        menus={{
          oils: orderedOils.map(toMenu),
          honey: honey.map(toMenu),
          sweeteners: sweeteners.map(toMenu),
        }}
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
  const upsells = await getProducts({ collection: "bestsellers", first: 4 });
  return <CartDrawer upsells={upsells} />;
}
