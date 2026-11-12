import type { Usual } from "@/components/account/Usuals";
import type { ProductInfo } from "@/components/account/OrderCard";
import type { Product } from "@/lib/commerce/types";

/** Thumbnail + Hindi name per product handle, for order cards. */
export const productInfo = (products: Product[]): ProductInfo =>
  Object.fromEntries(
    products.map((p) => [p.handle, { image: p.images[0]?.url, titleHi: p.titleHi }]),
  );

/**
 * Quick-add cards: the given variant ids first (most-bought), topped up with each product's
 * default size in catalogue order (bestsellers). Sold-out variants are skipped.
 */
export function buildUsuals(products: Product[], variantIds: string[] = [], max = 8): Usual[] {
  const variants = new Map(
    products.flatMap((p) => p.variants.map((v) => [v.id, { p, v }] as const)),
  );
  const out: Usual[] = [];
  const push = (id: string) => {
    const hit = variants.get(id);
    if (!hit || !hit.v.availableForSale || out.some((u) => u.variantId === id)) return;
    out.push({
      variantId: id,
      title: hit.p.title,
      titleHi: hit.p.titleHi,
      size: hit.v.title,
      price: hit.v.price.amount,
      mrp: hit.v.compareAtPrice?.amount ?? null,
      image: hit.p.images[0]?.url,
    });
  };
  variantIds.forEach(push);
  for (const p of products) {
    if (out.length >= max) break;
    const v =
      p.variants.find((x) => x.title === p.defaultSize && x.availableForSale) ??
      p.variants.find((x) => x.availableForSale);
    if (v) push(v.id);
  }
  return out.slice(0, max);
}
