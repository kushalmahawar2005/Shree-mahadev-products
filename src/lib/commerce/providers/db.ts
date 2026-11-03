import "server-only";
import { catalogIsEmpty, findVariants, loadCollections, loadProducts } from "@/lib/server/catalog";
import type { Cart, CartLine, CommerceProvider, GetProductsOptions, Product, ProductSort } from "../types";

/**
 * MySQL catalog provider (COMMERCE_PROVIDER=db). Same cookie cart format as the mock provider
 * ("mock_" + base64url [[variantKey, qty]]), so switching providers keeps shoppers' carts.
 */

type Encoded = [variantId: string, qty: number][];

const encode = (lines: Encoded) => "mock_" + Buffer.from(JSON.stringify(lines)).toString("base64url");

function decode(id: string): Encoded {
  if (!id.startsWith("mock_")) return [];
  try {
    const raw = JSON.parse(Buffer.from(id.slice(5), "base64url").toString("utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === "string" && Number.isInteger(x[1]) && x[1] > 0)
      .slice(0, 50)
      .map(([v, q]) => [v, Math.min(q, 99)]);
  } catch {
    return [];
  }
}

async function build(lines: Encoded): Promise<Cart> {
  const found = await findVariants(lines.map(([v]) => v));
  const byKey = new Map(found.map((f) => [f.variant.id, f]));
  const cartLines: CartLine[] = [];
  for (const [variantId, quantity] of lines) {
    const f = byKey.get(variantId);
    if (!f || f.status !== "active" || !f.variant.availableForSale) continue;
    const qty = f.variant.stock !== null ? Math.min(quantity, f.variant.stock) : quantity;
    if (qty <= 0) continue;
    cartLines.push({
      id: variantId,
      quantity: qty,
      variant: f.variant,
      product: { handle: f.handle, title: f.productTitle, images: [] },
    });
  }
  const subtotal = cartLines.reduce((s, l) => s + l.variant.price.amount * l.quantity, 0);
  return {
    id: encode(cartLines.map((l) => [l.id, l.quantity])),
    checkoutUrl: "/checkout",
    lines: cartLines,
    subtotal: { amount: subtotal, currencyCode: "INR" },
    totalQuantity: cartLines.reduce((s, l) => s + l.quantity, 0),
  };
}

function sortProducts(list: Product[], sort: ProductSort = "best") {
  const sorted = [...list];
  const min = (p: Product) => p.priceRange.min.amount || Number.POSITIVE_INFINITY;
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => min(a) - min(b));
    case "price-desc":
      return sorted.sort((a, b) => (b.priceRange.max.amount || 0) - (a.priceRange.max.amount || 0));
    case "new":
      return sorted.reverse();
    default: {
      const score = (p: Product) => (p.tags.includes("bestseller") ? 2 : 0) + (p.priceRange.min.amount > 0 ? 1 : 0);
      return sorted.sort((a, b) => score(b) - score(a));
    }
  }
}

const active = () => loadProducts({ status: "active" });

export const dbProvider: CommerceProvider = {
  async getProducts(opts: GetProductsOptions = {}) {
    let list: Product[] = await active();
    if (opts.collection) list = list.filter((p) => (p as Product & { collections: string[] }).collections.includes(opts.collection!));
    list = sortProducts(list, opts.sort);
    return opts.first ? list.slice(0, opts.first) : list;
  },

  async getProduct(handle) {
    const [p] = await loadProducts({ handles: [handle], status: "active" });
    return p;
  },

  async getCollection(handle) {
    const col = (await loadCollections()).find((c) => c.handle === handle);
    if (!col) return undefined;
    const products = (await active()).filter((p) => p.collections.includes(handle));
    return { handle: col.handle, title: col.title, description: col.description, products: sortProducts(products) };
  },

  async getCollections() {
    return (await loadCollections()).map(({ handle, title, description }) => ({ handle, title, description }));
  },

  async searchProducts(query) {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return (await active()).filter((p) => {
      const hay = [p.title, p.titleHi, p.shortDescription, ...p.tags, ...p.bestFor].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  },

  createCart: () => build([]),
  getCart: async (id) => build(decode(id)),
  async addToCart(cartId, variantId, quantity) {
    const lines = decode(cartId);
    const existing = lines.find((l) => l[0] === variantId);
    if (existing) existing[1] = Math.min(existing[1] + quantity, 99);
    else lines.push([variantId, Math.min(quantity, 99)]);
    return build(lines);
  },
  async updateCartLine(cartId, lineId, quantity) {
    return build(
      decode(cartId)
        .map(([v, q]): [string, number] => (v === lineId ? [v, Math.min(quantity, 99)] : [v, q]))
        .filter(([, q]) => q > 0),
    );
  },
  removeCartLine: async (cartId, lineId) => build(decode(cartId).filter(([v]) => v !== lineId)),
};

export { catalogIsEmpty };
