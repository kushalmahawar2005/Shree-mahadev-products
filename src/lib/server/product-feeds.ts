import "server-only";
import { site } from "@/data/site";
import { plainText, sizeSlug, variantImageUrl, variantUrl } from "@/lib/utils/seo";
import { loadProducts } from "./catalog";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const absolute = (url: string, siteUrl: string) =>
  url.startsWith("http") ? url : `${siteUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;

const tag = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : `<g:${name}>${escapeXml(String(value))}</g:${name}>`;

const CATEGORY = {
  oil: { type: "Wood-pressed oils", word: "Kachi Ghani" },
  honey: { type: "Raw honey", word: "Pure & Unprocessed" },
  sweetener: { type: "Natural sweeteners", word: "Chemical-free" },
} as const;

const METHOD = {
  oil: "Wood-pressed (kachi ghani) in a traditional wooden kolhu in Bijainagar, Rajasthan, at low speed with no heat, no chemicals and no refining, so the oil keeps its natural aroma, colour and nutrients.",
  honey: "Raw honey, not heated or filtered through chemicals, packed as it comes from the hive. No added sugar or syrup.",
  sweetener: "Made from sugarcane the traditional way, with no chemicals, bleaching or sulphur.",
} as const;

/**
 * Product feeds for Google Merchant Center (free listings + Shopping ads) and Meta Commerce Manager.
 * One item per size; sizes of a product share item_group_id and differ by `size`. Every link opens
 * the product page with that size chosen (?size=1l), and the page's structured data uses the same
 * URLs and prices, so Merchant Center's landing-page check matches.
 */
export async function buildProductFeed(kind: "google" | "meta") {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  // No database (preview deploy): an empty, valid feed instead of failing the build.
  const products = process.env.DATABASE_NAME ? await loadProducts({ status: "active" }) : [];
  const items = products.flatMap((product) => {
    const cat = CATEGORY[product.category] ?? CATEGORY.oil;
    const about = plainText(product.descriptionHtml) || plainText(product.shortDescription);
    const description = `${about ? `${about} ` : ""}${METHOD[product.category] ?? ""}`.trim().slice(0, 4900);
    const allImages = product.images.map((i) => absolute(i.url, siteUrl));
    return product.variants
      .filter((variant) => variant.enabled && variant.price.amount > 0)
      .map((variant) => {
        const id = variant.sku || `${product.handle}-${sizeSlug(variant.title)}`;
        const image = product.images.length ? variantImageUrl(product, variant.title) : absolute(`/images/placeholder-${product.handle}.svg`, siteUrl);
        const more = allImages.filter((u) => u !== image).slice(0, 10);
        const hasSale = !!variant.compareAtPrice && variant.compareAtPrice.amount > variant.price.amount;
        const price = `${(hasSale ? variant.compareAtPrice!.amount : variant.price.amount).toFixed(2)} INR`;
        const salePrice = hasSale ? `${variant.price.amount.toFixed(2)} INR` : null;
        // Brand + product + size + the word people search, as Google recommends for titles.
        const title = `${site.shortName} ${product.title} ${variant.title} – ${cat.word}${product.titleHi ? ` (${product.titleHi})` : ""}`.slice(0, 150);
        const weight = (variant as { weightGrams?: number | null }).weightGrams;
        return [
          "<item>",
          tag("id", id),
          tag("item_group_id", product.handle),
          tag("title", title),
          tag("description", description),
          tag("link", variantUrl(product.handle, variant.title)),
          tag("image_link", image),
          ...more.map((u) => tag("additional_image_link", u)),
          tag("availability", variant.availableForSale ? "in stock" : "out of stock"),
          tag("condition", "new"),
          tag("price", price),
          tag("sale_price", salePrice),
          tag("brand", site.name),
          tag("size", variant.title),
          tag("product_type", `${cat.type} > ${product.title.replace(/^(Wood|Cold)-Pressed\s+/i, "")}`),
          kind === "google" ? tag("identifier_exists", "no") : "",
          tag("mpn", variant.sku || id),
          weight ? tag("shipping_weight", `${weight} g`) : "",
          tag("custom_label_0", product.category),
          product.tags.includes("bestseller") ? tag("custom_label_1", "bestseller") : "",
          "</item>",
        ].join("");
      });
  });
  const namespace = 'xmlns:g="http://base.google.com/ns/1.0"';
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" ${namespace}><channel><title>${escapeXml(site.name)}</title><link>${escapeXml(siteUrl)}</link><description>${escapeXml(site.description)}</description>${items.join("")}</channel></rss>`;
}
