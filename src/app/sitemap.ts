import type { MetadataRoute } from "next";
import { content } from "@/content";
import { getCollections, getProducts } from "@/lib/commerce";
import { absoluteUrl } from "@/lib/utils/seo";

/** /sitemap.xml: store pages, every active product and collection, content and policies. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, collections] = await Promise.all([getProducts(), getCollections()]);
  // DB timestamps are "YYYY-MM-DD HH:MM:SS" (IST); content dates are "YYYY-MM-DD".
  const toDate = (s?: string) => {
    if (!s) return now;
    const iso = s.includes(" ") ? s.replace(" ", "T") : s.length === 10 ? `${s}T00:00:00` : s;
    const d = new Date(`${iso}+05:30`);
    return Number.isNaN(d.getTime()) ? now : d;
  };

  const fixed: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "daily"],
    ["/shop", 0.9, "daily"],
    ["/our-ghani", 0.6, "monthly"],
    ["/about", 0.6, "monthly"],
    ["/lab-reports", 0.6, "monthly"],
    ["/bulk-orders", 0.6, "monthly"],
    ["/faq", 0.5, "monthly"],
    ["/contact", 0.5, "monthly"],
    ["/track-order", 0.3, "yearly"],
    ["/recipes", 0.6, "weekly"],
    ["/journal", 0.6, "weekly"],
  ];

  return [
    // No lastModified on static pages / collections: "now" on every crawl teaches Google to ignore the field.
    ...fixed.map(([path, priority, changeFrequency]) => ({ url: absoluteUrl(path), changeFrequency, priority })),
    ...collections.map((c) => ({ url: absoluteUrl(`/collections/${c.handle}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${p.handle}`),
      lastModified: toDate((p as { updatedAt?: string }).updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: p.images.filter((i) => i.url.startsWith("http")).map((i) => i.url),
    })),
    ...content.recipes.map((e) => ({ url: absoluteUrl(`/recipes/${e.slug}`), lastModified: toDate(e.date), priority: 0.5 })),
    ...content.journal.map((e) => ({ url: absoluteUrl(`/journal/${e.slug}`), lastModified: toDate(e.date), priority: 0.5 })),
    ...content.policies.map((e) => ({ url: absoluteUrl(`/policies/${e.slug}`), lastModified: toDate(e.updated), priority: 0.2 })),
  ];
}
