import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { mockProvider } from "./providers/mock";
import { shopifyProvider } from "./providers/shopify";
import type { CommerceProvider, GetProductsOptions } from "./types";

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
} as const;

// ── Catalog reads: cached, revalidated by Shopify webhooks (/api/revalidate) ──

export async function getProducts(opts: GetProductsOptions = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);
  if (opts.collection) cacheTag(TAGS.collection(opts.collection));
  return provider.getProducts(opts);
}

export async function getProduct(handle: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products, TAGS.product(handle));
  return provider.getProduct(handle);
}

export async function getCollection(handle: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.collections, TAGS.products, TAGS.collection(handle));
  return provider.getCollection(handle);
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
  return provider.searchProducts(query);
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
