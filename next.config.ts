import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { legacyRedirects } from "./src/data/redirects";

const nextConfig: NextConfig = {
  cacheComponents: true,
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
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.myshopify.com" },
    ],
  },
  async redirects() {
    return legacyRedirects;
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
