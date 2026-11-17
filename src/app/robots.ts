import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://swadeshimahadevproducts.in";
// Both brand domains are real stores (.in now, .com once it moves over from the old WooCommerce site).
const isLiveDomain = /swadeshimahadevproducts\.(in|com)/.test(SITE);

export default function robots(): MetadataRoute.Robots {
  // Preview hosts (vercel.app, localhost) must never be indexed.
  if (!isLiveDomain) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // /order pages are noindex; they stay crawlable so Google can actually see that tag.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/checkout", "/cart/", "/api/"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
