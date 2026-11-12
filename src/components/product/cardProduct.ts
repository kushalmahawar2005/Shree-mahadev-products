import type { Product } from "@/lib/commerce/types";

/** The slice of a product every <ProductCard/> (and its Quick view) needs. Plain module: safe from server code. */
export type CardProduct = Pick<
  Product,
  "handle" | "title" | "titleHi" | "shortDescription" | "images" | "variants" | "rating" | "reviewCount" | "tags" | "swatch" | "defaultSize"
> &
  Partial<Pick<Product, "category" | "benefits" | "bestFor">>;

export function toCardProduct(p: Product): CardProduct {
  const { handle, title, titleHi, shortDescription, images, variants, rating, reviewCount, tags, swatch, defaultSize, category, benefits, bestFor } = p;
  return { handle, title, titleHi, shortDescription, images, variants, rating, reviewCount, tags, swatch, defaultSize, category, benefits, bestFor };
}
