import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { mockProvider } from "./providers/mock";
import { shopifyProvider } from "./providers/shopify";
import { withDbImages } from "@/lib/server/media";
import type { CommerceProvider, GetProductsOptions, Product } from "./types";

export * from "./types";

/**
 * Single entry point for commerce data. UI never talks to Shopify directly.
 * COMMERCE_PROVIDER=mock|shopify picks the backend.
 */
const provider: CommerceProvider =
  process.env.COMMERCE_PROVIDER === "shopify" ? shopifyProvider : mockProvider;

export const TAGS = {
  products: "products",
  collections: "collections",
  product: (handle: string) => `product:${handle}`,
  collection: (handle: string) => `collection:${handle}`,
  banners: "banners",
} as const;

// ── Catalog reads: cached, revalidated by Shopify webhooks (/api/revalidate) ──

export async function getProducts(opts: GetProductsOptions = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);
  if (opts.collection) cacheTag(TAGS.collection(opts.collection));
  return withDbImages(await provider.getProducts(opts));
}

export async function getProduct(handle: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products, TAGS.product(handle));
  const p = await provider.getProduct(handle);
  return p ? (await withDbImages([p]))[0] : p;
}

export async function getCollection(handle: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.collections, TAGS.products, TAGS.collection(handle));
  const c = await provider.getCollection(handle);
  return c ? { ...c, products: await withDbImages(c.products) } : c;
}

export async function getCollections() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.collections);
  return provider.getCollections();
}

export async function searchProducts(query: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.products);
  return withDbImages(await provider.searchProducts(query));
}

// ── Cart: never cached. Call through Server Actions in ./actions.ts ──

export const createCart = () => provider.createCart();
export const getCart = (id: string) => provider.getCart(id);
export const addToCart = (cartId: string, variantId: string, qty: number) =>
  provider.addToCart(cartId, variantId, qty);
export const updateCartLine = (cartId: string, lineId: string, qty: number) =>
  provider.updateCartLine(cartId, lineId, qty);
export const removeCartLine = (cartId: string, lineId: string) =>
  provider.removeCartLine(cartId, lineId);

/** Cart thumbnails use the same uploaded photos as the catalog. */
export async function getProductImagesMap(handles: string[]) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);
  const list = await withDbImages(handles.map((handle) => ({ handle, title: "", images: [] as Product["images"] })));
  return Object.fromEntries(list.map((p) => [p.handle, p.images]));
}
