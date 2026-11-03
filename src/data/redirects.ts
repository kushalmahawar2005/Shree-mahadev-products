/**
 * 301 redirects from the old WooCommerce site (swadeshimahadevproducts.com).
 *
 * The old site had one product per size (e.g. /product/wood-pressed-groundnut-oil-5-litre/).
 * Every size URL must land on its single new product. We match on keywords in the old
 * slug, most specific first (black-mustard before mustard, etc.).
 *
 * TODO(client): export the full old URL list from WooCommerce (Products → Export) and
 * verify every old slug hits the right handle below.
 */
type Redirect = { source: string; destination: string; permanent: true };

// [regex fragment matched inside the old slug, new handle]
const productKeywordMap: [string, string][] = [
  ["black-mustard|kali-sarso", "black-mustard-oil"],
  ["yellow-mustard|mustard|sarso", "yellow-mustard-oil"],
  ["black-sesame|black-til|kala-til", "black-sesame-oil"],
  ["white-sesame|safed-til", "white-sesame-oil"],
  ["brown-sesame|sesame|til", "brown-sesame-oil"],
  ["groundnut|peanut|mungfali|moongfali", "groundnut-oil"],
  ["flax|alsi", "flaxseed-oil"],
  ["coconut|nariyal", "coconut-oil"],
  ["sunflower", "sunflower-oil"],
  ["almond|badam", "almond-oil"],
  ["walnut|akhrot", "walnut-oil"],
  ["castor|arandi", "castor-oil"],
  ["jamun", "jamun-raw-honey"],
  ["sunderban|sundarban", "sunderban-raw-honey"],
  ["tulsi", "van-tulsi-raw-honey"],
  ["khand", "desi-khand"],
  ["jaggery|gud|gur", "jaggery-powder"],
];

const categoryMap: [string, string][] = [
  ["oil|wood-pressed|cold-pressed", "wood-pressed-oils"],
  ["honey", "raw-honey"],
  ["sweetener|khand|jaggery", "natural-sweeteners"],
];

export const legacyRedirects: Redirect[] = [
  ...productKeywordMap.map(([kw, handle]) => ({
    source: `/product/:slug(.*(?:${kw}).*)`,
    destination: `/products/${handle}`,
    permanent: true as const,
  })),
  { source: "/product/:slug*", destination: "/shop", permanent: true },
  ...categoryMap.map(([kw, handle]) => ({
    source: `/product-category/:slug(.*(?:${kw}).*)`,
    destination: `/collections/${handle}`,
    permanent: true as const,
  })),
  { source: "/product-category/:slug*", destination: "/shop", permanent: true },
  { source: "/cart", destination: "/shop", permanent: true },
  { source: "/my-account", destination: "/track-order", permanent: true },
  { source: "/contact-us", destination: "/contact", permanent: true },
  { source: "/about-us", destination: "/about", permanent: true },
  { source: "/privacy-policy", destination: "/policies/privacy", permanent: true },
  { source: "/refund_returns", destination: "/policies/refund-return", permanent: true },
];
