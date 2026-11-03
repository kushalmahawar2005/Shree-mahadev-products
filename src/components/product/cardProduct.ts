import type { Product } from "@/lib/commerce/types";

export type CardProduct = Pick<
  Product,
  "handle" | "title" | "titleHi" | "swatch" | "images" | "variants" | "priceRange" | "rating" | "reviewCount"
>;

export function toCardProduct(p: Product): CardProduct {
  const { handle, title, titleHi, swatch, images, variants, priceRange, rating, reviewCount } = p;
  return { handle, title, titleHi, swatch, images, variants, priceRange, rating, reviewCount };
}
