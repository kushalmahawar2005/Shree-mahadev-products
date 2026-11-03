import type { CommerceProvider, ProductSort } from "../../types";
import { shopifyFetch } from "./client";
import { CART_CREATE, CART_LINES_ADD, CART_LINES_REMOVE, CART_LINES_UPDATE } from "./mutations";
import { normalizeCart, normalizeProduct, type SCart, type SProduct } from "./normalize";
import { CART_QUERY, COLLECTION_QUERY, COLLECTIONS_QUERY, PRODUCT_QUERY, PRODUCTS_QUERY } from "./queries";

function sortArgs(sort: ProductSort = "best", inCollection = false) {
  switch (sort) {
    case "price-asc":
      return { sortKey: "PRICE", reverse: false };
    case "price-desc":
      return { sortKey: "PRICE", reverse: true };
    case "new":
      return { sortKey: inCollection ? "CREATED" : "CREATED_AT", reverse: true };
    default:
      return { sortKey: "BEST_SELLING", reverse: false };
  }
}

type CartPayload = { cart: SCart | null; userErrors: { message: string }[] };

function cartOrThrow(payload: CartPayload) {
  if (payload.userErrors.length) throw new Error(payload.userErrors.map((e) => e.message).join("; "));
  if (!payload.cart) throw new Error("Shopify returned no cart");
  return normalizeCart(payload.cart);
}

export const shopifyProvider: CommerceProvider = {
  async getProducts(opts = {}) {
    if (opts.collection) {
      const data = await shopifyFetch<{ collection: { products: { nodes: SProduct[] } } | null }>(
        COLLECTION_QUERY,
        { handle: opts.collection, first: opts.first ?? 100, ...sortArgs(opts.sort, true) },
      );
      return data.collection?.products.nodes.map(normalizeProduct) ?? [];
    }
    const data = await shopifyFetch<{ products: { nodes: SProduct[] } }>(PRODUCTS_QUERY, {
      first: opts.first ?? 100,
      ...sortArgs(opts.sort),
    });
    return data.products.nodes.map(normalizeProduct);
  },

  async getProduct(handle) {
    const data = await shopifyFetch<{ product: SProduct | null }>(PRODUCT_QUERY, { handle });
    return data.product ? normalizeProduct(data.product) : undefined;
  },

  async getCollection(handle) {
    const data = await shopifyFetch<{
      collection: {
        handle: string;
        title: string;
        description: string;
        image: { url: string; altText: string | null } | null;
        products: { nodes: SProduct[] };
      } | null;
    }>(COLLECTION_QUERY, { handle, first: 100, ...sortArgs("best", true) });
    const c = data.collection;
    if (!c) return undefined;
    return {
      handle: c.handle,
      title: c.title,
      description: c.description,
      image: c.image ? { url: c.image.url, alt: c.image.altText ?? c.title } : undefined,
      products: c.products.nodes.map(normalizeProduct),
    };
  },

  async getCollections() {
    const data = await shopifyFetch<{
      collections: {
        nodes: { handle: string; title: string; description: string; image: { url: string; altText: string | null } | null }[];
      };
    }>(COLLECTIONS_QUERY);
    return data.collections.nodes.map((c) => ({
      handle: c.handle,
      title: c.title,
      description: c.description,
      image: c.image ? { url: c.image.url, alt: c.image.altText ?? c.title } : undefined,
    }));
  },

  async searchProducts(query) {
    const data = await shopifyFetch<{ products: { nodes: SProduct[] } }>(PRODUCTS_QUERY, {
      first: 30,
      query,
      sortKey: "RELEVANCE",
      reverse: false,
    });
    return data.products.nodes.map(normalizeProduct);
  },

  async createCart() {
    const data = await shopifyFetch<{ cartCreate: CartPayload }>(CART_CREATE);
    return cartOrThrow(data.cartCreate);
  },

  async getCart(id) {
    const data = await shopifyFetch<{ cart: SCart | null }>(CART_QUERY, { id });
    return data.cart ? normalizeCart(data.cart) : undefined;
  },

  async addToCart(cartId, variantId, quantity) {
    const data = await shopifyFetch<{ cartLinesAdd: CartPayload }>(CART_LINES_ADD, {
      cartId,
      lines: [{ merchandiseId: variantId, quantity }],
    });
    return cartOrThrow(data.cartLinesAdd);
  },

  async updateCartLine(cartId, lineId, quantity) {
    const data = await shopifyFetch<{ cartLinesUpdate: CartPayload }>(CART_LINES_UPDATE, {
      cartId,
      lines: [{ id: lineId, quantity }],
    });
    return cartOrThrow(data.cartLinesUpdate);
  },

  async removeCartLine(cartId, lineId) {
    const data = await shopifyFetch<{ cartLinesRemove: CartPayload }>(CART_LINES_REMOVE, {
      cartId,
      lineIds: [lineId],
    });
    return cartOrThrow(data.cartLinesRemove);
  },
};
