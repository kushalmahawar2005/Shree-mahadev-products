import type { Product } from "@/lib/commerce/types";

export type PickProduct = Pick<
  Product,
  "handle" | "title" | "titleHi" | "shortDescription" | "images" | "variants" | "rating" | "reviewCount" | "tags" | "swatch"
>;

export function toPickProduct(p: Product): PickProduct {
  const { handle, title, titleHi, shortDescription, images, variants, rating, reviewCount, tags, swatch } = p;
  return { handle, title, titleHi, shortDescription, images, variants, rating, reviewCount, tags, swatch };
}
