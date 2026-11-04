import "server-only";
import { loadProducts } from "./catalog";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const absolute = (url: string, siteUrl: string) =>
  url.startsWith("http") ? url : `${siteUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;

export async function buildProductFeed(kind: "google" | "meta") {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const products = await loadProducts({ status: "active" });
  const items = products.flatMap((product) =>
    product.variants.filter((variant) => variant.enabled && variant.price.amount > 0).map((variant) => {
      const id = variant.sku || variant.id;
      const image = absolute(product.images[0]?.url ?? `/images/placeholder-${product.handle}.svg`, siteUrl);
      const url = `${siteUrl.replace(/\/$/, "")}/products/${product.handle}?size=${encodeURIComponent(variant.title)}`;
      const availability = variant.availableForSale ? "in stock" : "out of stock";
      const salePrice = variant.compareAtPrice && variant.compareAtPrice.amount > variant.price.amount
        ? variant.price.amount
        : null;
      if (kind === "meta") {
        return `<item><g:id>${escapeXml(id)}</g:id><g:title>${escapeXml(`${product.title} - ${variant.title}`)}</g:title><g:description>${escapeXml(product.shortDescription)}</g:description><g:link>${escapeXml(url)}</g:link><g:image_link>${escapeXml(image)}</g:image_link><g:availability>${availability}</g:availability><g:price>${variant.compareAtPrice?.amount ?? variant.price.amount}.00 INR</g:price>${salePrice !== null ? `<g:sale_price>${salePrice}.00 INR</g:sale_price>` : ""}<g:brand>Swadeshi Mahadev</g:brand><g:item_group_id>${escapeXml(product.handle)}</g:item_group_id></item>`;
      }
      return `<item><g:id>${escapeXml(id)}</g:id><g:title>${escapeXml(`${product.title} - ${variant.title}`)}</g:title><g:description>${escapeXml(product.shortDescription)}</g:description><g:link>${escapeXml(url)}</g:link><g:image_link>${escapeXml(image)}</g:image_link><g:availability>${availability}</g:availability><g:condition>new</g:condition><g:price>${variant.compareAtPrice?.amount ?? variant.price.amount}.00 INR</g:price>${salePrice !== null ? `<g:sale_price>${salePrice}.00 INR</g:sale_price>` : ""}<g:brand>Swadeshi Mahadev</g:brand><g:product_type>${escapeXml(product.category)}</g:product_type><g:item_group_id>${escapeXml(product.handle)}</g:item_group_id></item>`;
    }),
  );
  const namespace = "xmlns:g=\"http://base.google.com/ns/1.0\"";
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" ${namespace}><channel><title>Swadeshi Mahadev Products</title><link>${escapeXml(siteUrl)}</link><description>Authentic wood-pressed oils and natural products.</description>${items.join("")}</channel></rss>`;
}
