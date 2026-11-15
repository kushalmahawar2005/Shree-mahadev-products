import type { MetadataRoute } from "next";

/** Installable app (Add to Home screen): opens full screen on the storefront, brand colours, quick shortcuts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Swadeshi Mahadev Products",
    short_name: "Mahadev",
    description: "Wood-pressed kachi ghani oils, raw honey and desi jaggery from our family ghani in Bijainagar, Rajasthan.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6EFE2",
    theme_color: "#0E3B26",
    lang: "en-IN",
    categories: ["shopping", "food"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shop all", short_name: "Shop", url: "/shop?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Track my order", short_name: "Track", url: "/track-order?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My orders", short_name: "Orders", url: "/account/orders?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
