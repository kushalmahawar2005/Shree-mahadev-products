import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { legacyRedirects } from "./src/data/redirects";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Dev-only badge: keep it off the admin sidebar (bottom-left).
  devIndicators: false,
  // Let phones/clients open the dev server through an ngrok tunnel (HMR + dev chunks).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "*.trycloudflare.com"],
  // A separate QA runtime can coexist with the user's normal local dev server.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  cacheComponents: true,
  // Short shared-cache life for pages. Hostinger's CDN follows the page Cache-Control
  // (s-maxage = revalidate, stale-while-revalidate = expire - revalidate). The presets let it serve a page
  // up to a day old, so after a deploy (or an hPanel-triggered rebuild) visitors kept getting old HTML
  // whose CSS / server actions no longer exist. With these values a page is at most ~30 min old.
  // NOTE: "hours" is redefined here (15 min revalidate, 30 min expire); keep-warm crons refresh pages.
  cacheLife: {
    default: { stale: 300, revalidate: 900, expire: 1800 },
    hours: { stale: 300, revalidate: 900, expire: 1800 },
  },
  // Two root layouts (store + admin): unmatched URLs use app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  partialPrefetching: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // All photos are served from Cloudinary (resized + compressed on their CDN).
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    qualities: [75, 85],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Service worker: always re-checked so app updates reach installed users right away.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // One canonical host: www.* → apex, permanent (also covers http→https via Hostinger).
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "www.swadeshimahadevproducts.in" }],
        destination: "https://swadeshimahadevproducts.in/:path*",
        permanent: true,
      },
      // The old WooCommerce domain (.com, parked on this site): same path on .in, where the legacy
      // rules below send old /product/... URLs to the right new product.
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "(www\\.)?swadeshimahadevproducts\\.com" }],
        destination: "https://swadeshimahadevproducts.in/:path*",
        permanent: true,
      },
      ...legacyRedirects,
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
