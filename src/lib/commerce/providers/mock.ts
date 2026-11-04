import { collectionDefs } from "@/data/collections";
import { products } from "@/data/products";
import type {
  Cart,
  CartLine,
  Collection,
  CommerceProvider,
  GetProductsOptions,
  Product,
  ProductSort,
} from "../types";

/**
 * Mock provider: reads typed local data from src/data.
 *
 * The cart is stateless: the cart "id" is the cart contents itself (base64url JSON of
 * [variantId, qty] pairs). It lives in the httpOnly cart cookie, so it survives
 * serverless cold starts without any database.
 */

type Encoded = [variantId: string, qty: number][];

function encode(lines: Encoded): string {
  return "mock_" + Buffer.from(JSON.stringify(lines)).toString("base64url");
}

function decode(id: string): Encoded {
  if (!id.startsWith("mock_")) return [];
  try {
    const raw = JSON.parse(Buffer.from(id.slice(5), "base64url").toString("utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (x): x is [string, number] =>
          Array.isArray(x) && typeof x[0] === "string" && Number.isInteger(x[1]) && x[1] > 0,
      )
      .slice(0, 50)
      .map(([v, q]) => [v, Math.min(q, 99)]);
  } catch {
    return [];
  }
}

function findVariant(variantId: string) {
  for (const p of products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  return undefined;
}

function build(lines: Encoded): Cart {
  const cartLines: CartLine[] = [];
  for (const [variantId, quantity] of lines) {
    const found = findVariant(variantId);
    if (!found || !found.variant.availableForSale) continue;
    cartLines.push({
      id: variantId,
      quantity,
      variant: found.variant,
      product: {
        handle: found.product.handle,
        title: found.product.title,
        images: found.product.images,
      },
    });
  }
  const subtotal = cartLines.reduce((s, l) => s + l.variant.price.amount * l.quantity, 0);
  const totalQuantity = cartLines.reduce((s, l) => s + l.quantity, 0);
  const id = encode(cartLines.map((l) => [l.id, l.quantity]));

  return {
    id,
    checkoutUrl: "/checkout",
    lines: cartLines,
    subtotal: { amount: subtotal, currencyCode: "INR" },
    totalQuantity,
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
    case "best":
    default:
      // Bestsellers first, then products with prices, then catalog order.
      return sorted.sort((a, b) => {
        const score = (p: Product) =>
          (p.tags.includes("bestseller") ? 2 : 0) + (p.priceRange.min.amount > 0 ? 1 : 0);
        return score(b) - score(a);
      });
  }
}

export const mockProvider: CommerceProvider = {
  async getProducts(opts: GetProductsOptions = {}) {
    let list = products;
    if (opts.collection) {
      const def = collectionDefs.find((c) => c.handle === opts.collection);
      list = def ? products.filter(def.match) : [];
    }
    list = sortProducts(list, opts.sort);
    return opts.first ? list.slice(0, opts.first) : list;
  },

  async getProduct(handle) {
    return products.find((p) => p.handle === handle);
  },

  async getCollection(handle): Promise<Collection | undefined> {
    const def = collectionDefs.find((c) => c.handle === handle);
    if (!def) return undefined;
    return {
      handle: def.handle,
      title: def.title,
      description: def.description,
      inMenu: ["wood-pressed-oils", "raw-honey", "natural-sweeteners", "bestsellers"].includes(def.handle),
      menuOrder: ["wood-pressed-oils", "raw-honey", "natural-sweeteners", "bestsellers"].indexOf(def.handle),
      showHomepage: def.handle === "bestsellers",
      products: sortProducts(products.filter(def.match)),
    };
  },

  async getCollections() {
    return collectionDefs.map(({ handle, title, description }) => ({
      handle, title, description,
      inMenu: ["wood-pressed-oils", "raw-honey", "natural-sweeteners", "bestsellers"].includes(handle),
      menuOrder: ["wood-pressed-oils", "raw-honey", "natural-sweeteners", "bestsellers"].indexOf(handle),
      showHomepage: handle === "bestsellers",
    }));
  },

  async searchProducts(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return products.filter((p) => {
      const hay = [p.title, p.titleHi, p.shortDescription, ...p.tags, ...p.bestFor]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  },

  async createCart() {
    return build([]);
  },

  async getCart(id) {
    return build(decode(id));
  },

  async addToCart(cartId, variantId, quantity) {
    const lines = decode(cartId);
    const existing = lines.find((l) => l[0] === variantId);
    if (existing) existing[1] = Math.min(existing[1] + quantity, 99);
    else lines.push([variantId, Math.min(quantity, 99)]);
    return build(lines);
  },

  async updateCartLine(cartId, lineId, quantity) {
    const lines = decode(cartId)
      .map(([v, q]): [string, number] => (v === lineId ? [v, Math.min(quantity, 99)] : [v, q]))
      .filter(([, q]) => q > 0);
    return build(lines);
  },

  async removeCartLine(cartId, lineId) {
    return build(decode(cartId).filter(([v]) => v !== lineId));
  },
};
