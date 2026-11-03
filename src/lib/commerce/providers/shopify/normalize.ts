import type { Cart, Money, Product, ProductCategory, ProductVariant } from "../../types";

type SMoney = { amount: string; currencyCode: string };
type SImage = { url: string; altText: string | null; width: number; height: number };
type SMetafield = { key: string; value: string; reference?: { url?: string } | null } | null;

export type SVariant = {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  price: SMoney;
  compareAtPrice: SMoney | null;
  selectedOptions?: { name: string; value: string }[];
};

export type SProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  seo: { title: string | null; description: string | null };
  priceRange: { minVariantPrice: SMoney; maxVariantPrice: SMoney };
  images: { nodes: SImage[] };
  variants: { nodes: SVariant[] };
  metafields: SMetafield[];
};

export type SCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: SMoney };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      merchandise: SVariant & {
        product: { handle: string; title: string; images: { nodes: SImage[] } };
      };
    }[];
  };
};

const money = (m: SMoney): Money => ({ amount: Number(m.amount), currencyCode: "INR" });

/** "1 L" | "500ml" | "1kg" → { sizeValue, sizeUnit } */
function parseSize(title: string): Pick<ProductVariant, "sizeValue" | "sizeUnit"> {
  const m = title.replace(/\s+/g, "").match(/^(\d+(?:\.\d+)?)(ml|l|ltr|litre|g|gm|kg)$/i);
  if (!m) return { sizeValue: 0, sizeUnit: "ml" };
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (["l", "ltr", "litre"].includes(u)) return { sizeValue: n * 1000, sizeUnit: "ml" };
  if (u === "kg") return { sizeValue: n * 1000, sizeUnit: "g" };
  if (u === "g" || u === "gm") return { sizeValue: n, sizeUnit: "g" };
  return { sizeValue: n, sizeUnit: "ml" };
}

export function normalizeVariant(v: SVariant): ProductVariant {
  const size = v.selectedOptions?.find((o) => /size|weight|volume/i.test(o.name))?.value ?? v.title;
  return {
    id: v.id,
    title: v.title,
    ...parseSize(size),
    price: money(v.price),
    compareAtPrice: v.compareAtPrice ? money(v.compareAtPrice) : undefined,
    availableForSale: v.availableForSale,
    sku: v.sku ?? undefined,
  };
}

function mf(p: SProduct, key: string) {
  return p.metafields.find((m) => m?.key === key) ?? undefined;
}

function list(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function category(p: SProduct): ProductCategory {
  const t = `${p.productType} ${p.tags.join(" ")}`.toLowerCase();
  if (t.includes("honey")) return "honey";
  if (t.includes("sweetener") || t.includes("jaggery") || t.includes("khand")) return "sweetener";
  return "oil";
}

export function normalizeProduct(p: SProduct): Product {
  let faqs: Product["faqs"];
  try {
    const raw = mf(p, "faqs")?.value;
    faqs = raw ? JSON.parse(raw) : undefined;
  } catch {
    faqs = undefined;
  }

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    titleHi: mf(p, "title_hi")?.value ?? "",
    category: category(p),
    swatch: mf(p, "swatch")?.value,
    shortDescription: p.seo.description ?? p.description.slice(0, 120),
    descriptionHtml: p.descriptionHtml,
    benefits: list(mf(p, "benefits")?.value),
    bestFor: list(mf(p, "best_for")?.value),
    howToUse: mf(p, "how_to_use")?.value,
    processNote: mf(p, "process_note")?.value,
    labReportUrl: mf(p, "lab_report")?.reference?.url,
    shelfLife: mf(p, "shelf_life")?.value,
    images: p.images.nodes.map((i) => ({
      url: i.url,
      alt: i.altText ?? p.title,
      width: i.width,
      height: i.height,
    })),
    variants: p.variants.nodes.map(normalizeVariant),
    priceRange: {
      min: money(p.priceRange.minVariantPrice),
      max: money(p.priceRange.maxVariantPrice),
    },
    // TODO: wire Judge.me rating metafields (reviews.rating / reviews.rating_count)
    rating: undefined,
    reviewCount: undefined,
    tags: p.tags,
    faqs,
    seo: {
      title: p.seo.title ?? p.title,
      description: p.seo.description ?? p.description.slice(0, 155),
    },
  };
}

export function normalizeCart(c: SCart): Cart {
  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl,
    totalQuantity: c.totalQuantity,
    subtotal: money(c.cost.subtotalAmount),
    lines: c.lines.nodes.map((l) => ({
      id: l.id,
      quantity: l.quantity,
      variant: normalizeVariant(l.merchandise),
      product: {
        handle: l.merchandise.product.handle,
        title: l.merchandise.product.title,
        images: l.merchandise.product.images.nodes.map((i) => ({
          url: i.url,
          alt: i.altText ?? l.merchandise.product.title,
          width: i.width,
          height: i.height,
        })),
      },
    })),
  };
}
