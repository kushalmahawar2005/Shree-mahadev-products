import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://swadeshimahadevproducts.com";
const isLiveDomain = SITE.includes("swadeshimahadevproducts.com");

export default function robots(): MetadataRoute.Robots {
  // Preview hosts (vercel.app, localhost) must never be indexed.
  if (!isLiveDomain) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/checkout", "/order", "/cart/", "/api/"] },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
