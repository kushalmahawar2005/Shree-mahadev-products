import type { Product } from "@/lib/commerce/types";

export type PickProduct = Pick<
  Product,
  "handle" | "title" | "titleHi" | "shortDescription" | "images" | "variants" | "rating" | "reviewCount" | "tags"
>;

export function toPickProduct(p: Product): PickProduct {
  const { handle, title, titleHi, shortDescription, images, variants, rating, reviewCount, tags } = p;
  return { handle, title, titleHi, shortDescription, images, variants, rating, reviewCount, tags };
}
