import type { Product } from "@/lib/commerce/types";

export type CardProduct = Pick<
  Product,
  "handle" | "title" | "titleHi" | "shortDescription" | "swatch" | "images" | "variants" | "priceRange" | "rating" | "reviewCount" | "tags"
>;

export function toCardProduct(p: Product): CardProduct {
  const { handle, title, titleHi, shortDescription, swatch, images, variants, priceRange, rating, reviewCount, tags } = p;
  return { handle, title, titleHi, shortDescription, swatch, images, variants, priceRange, rating, reviewCount, tags };
}
