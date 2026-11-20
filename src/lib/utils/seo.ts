import type { Metadata } from "next";
import { showRating } from "@/lib/utils/reviews";
import type { Product } from "@/lib/commerce/types";
import { fullAddress, site } from "@/data/site";

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}

/** Share card for pages without their own image (home, shop, content pages): public/og-default.png. */
export const DEFAULT_OG_IMAGE = "/og-default.png";

export function pageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  /** Open Graph type ("product" pages are sent as "website": Next has no product og type). */
  type?: "website" | "article" | "product";
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: site.name,
      locale: "en_IN",
      type: type === "article" ? "article" : "website",
      // A page-level openGraph replaces the layout's, so always carry an image (own photo or the default card).
      images: image ? [{ url: image, alt: imageAlt ?? title }] : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: site.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image ?? DEFAULT_OG_IMAGE] },
  };
}

const ORG_ID = () => absoluteUrl("/#organization");

/**
 * The store's return rule, for Google (search + Shopping): a replacement or refund only for damaged,
 * leaking or expired items, claimed within 7 days of delivery with an unboxing video
 * (src/content/policies/refund-return.mdx). Keep both in sync.
 */
export function returnPolicyJsonLd() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "IN",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
    returnMethod: "https://schema.org/ReturnByMail",
    itemDefectReturnFees: "https://schema.org/FreeReturn",
    refundType: "https://schema.org/FullRefund",
    merchantReturnLink: absoluteUrl("/policies/refund-return"),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID(),
    name: site.name,
    alternateName: [site.shortName, "Mahadev Products", "Shree Mahadev Products"],
    url: site.url,
    logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png") },
    image: absoluteUrl("/og-default.png"),
    description: site.description,
    email: site.email,
    telephone: site.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.line1,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: site.phone,
      email: site.email,
      contactType: "customer service",
      areaServed: "IN",
      availableLanguage: ["en", "hi"],
    },
    taxID: site.gst,
    hasMerchantReturnPolicy: returnPolicyJsonLd(),
    sameAs: site.socials.map((s) => s.href),
  };
}

/** Site name in Google results ("Swadeshi Mahadev Products" instead of the bare domain). */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: site.name,
    alternateName: [site.shortName, "Mahadev Products"],
    url: site.url,
    inLanguage: "en-IN",
    publisher: { "@id": ORG_ID() },
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": absoluteUrl("/#store"),
    name: site.name,
    url: site.url,
    image: absoluteUrl("/logo.png"),
    logo: absoluteUrl("/logo.png"),
    telephone: site.phone,
    email: site.email,
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "UPI, Credit card, Debit card, Net banking, Cash on delivery",
    parentOrganization: { "@id": ORG_ID() },
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.line1,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    description: `${site.description} ${fullAddress}.`,
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "18:00",
    },
  };
}

/** Plain text from the small markdown used in product copy (**bold**, _em_, links). */
export function plainText(s: string | undefined | null) {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** "1 L" → "1l", "500 ml" → "500ml": the slug used in photo names and ?size= links. */
export const sizeSlug = (title: string) => title.toLowerCase().replace(/\s+/g, "");

/** Product page link that opens with this size selected (feeds + structured data use the same URL). */
export function variantUrl(handle: string, sizeTitle: string) {
  return absoluteUrl(`/products/${handle}?size=${sizeSlug(sizeTitle)}`);
}

/** The photo of this size (front shot), else the product's first photo. */
export function variantImageUrl(p: Pick<Product, "images">, sizeTitle: string) {
  const own = p.images.find((i) => i.url.includes(`/${sizeSlug(sizeTitle)}-front.`));
  return absoluteUrl((own ?? p.images[0])?.url ?? "/logo.png");
}

const CATEGORY_LABEL: Record<Product["category"], string> = {
  oil: "Wood-pressed oil",
  honey: "Raw honey",
  sweetener: "Natural sweetener",
};

/**
 * Product structured data in Google's variant format: one ProductGroup (the product page) with one
 * Product per size, each with its own price, photo, stock and link. Sizes at or above the free-shipping
 * amount carry free shipping; every offer carries the 7-day damaged/expired return policy.
 */
export function productJsonLd(p: Product, opts: { freeShippingThreshold?: number } = {}) {
  const url = absoluteUrl(`/products/${p.handle}`);
  const description = plainText(p.seo?.description || p.shortDescription || p.descriptionHtml) || p.title;
  const free = opts.freeShippingThreshold;
  const delivery = {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 2, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 7, unitCode: "DAY" },
  };
  const variants = p.variants
    .filter((v) => v.price.amount > 0)
    .map((v) => {
      const freeShip = free !== undefined && (free === 0 || v.price.amount >= free);
      return {
        "@type": "Product",
        "@id": `${url}#${sizeSlug(v.title)}`,
        sku: v.sku || `${p.handle}-${sizeSlug(v.title)}`,
        mpn: v.sku || undefined,
        name: `${p.title} ${v.title}`,
        size: v.title,
        image: variantImageUrl(p, v.title),
        description,
        brand: { "@type": "Brand", name: site.name },
        offers: {
          "@type": "Offer",
          url: variantUrl(p.handle, v.title),
          price: v.price.amount,
          priceCurrency: v.price.currencyCode,
          availability: v.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": ORG_ID() },
          hasMerchantReturnPolicy: returnPolicyJsonLd(),
          ...(v.compareAtPrice && v.compareAtPrice.amount > v.price.amount
            ? {
                priceSpecification: {
                  "@type": "UnitPriceSpecification",
                  priceType: "https://schema.org/StrikethroughPrice",
                  price: v.compareAtPrice.amount,
                  priceCurrency: v.compareAtPrice.currencyCode,
                },
              }
            : {}),
          // Only the free case is stated: below it the courier rate depends on the pincode.
          ...(freeShip
            ? {
                shippingDetails: {
                  "@type": "OfferShippingDetails",
                  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "INR" },
                  shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
                  deliveryTime: delivery,
                },
              }
            : {}),
        },
      };
    });
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": `${url}#product`,
    productGroupID: p.handle,
    name: p.title,
    alternateName: p.titleHi || undefined,
    description,
    url,
    image: p.images.map((i) => absoluteUrl(i.url)),
    brand: { "@type": "Brand", name: site.name },
    manufacturer: { "@id": ORG_ID() },
    category: CATEGORY_LABEL[p.category],
    countryOfOrigin: "IN",
    variesBy: ["https://schema.org/size"],
    hasVariant: variants,
    // Only when the page itself shows the rating (5+ reviews): markup must match visible content.
    ...(p.rating && showRating(p.reviewCount)
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.rating,
            reviewCount: p.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

const KEYWORD: Record<Product["category"], string> = {
  oil: "Kachi Ghani",
  honey: "Pure & Unprocessed",
  sweetener: "Chemical-free",
};

/**
 * Search title for a product page: what people type (English + Hindi name + "kachi ghani"), kept
 * near 60 characters before the " | Swadeshi Mahadev Products" suffix. An admin-written SEO title
 * wins when it is more than the plain product name.
 */
export function productMetaTitle(p: Product) {
  const custom = plainText(p.seo?.title);
  if (custom && custom.toLowerCase() !== p.title.toLowerCase() && !custom.startsWith(`${p.title} (`)) return custom;
  const hi = p.titleHi ? ` ${p.titleHi}` : "";
  return `${p.title} – ${KEYWORD[p.category]}${hi}`;
}

/**
 * Search snippet: price from, sizes, the method and the trust points, 150–160 characters. An
 * admin-written SEO description wins when it is a real sentence (110+ characters).
 */
export function productMetaDescription(p: Product, opts: { freeShippingThreshold?: number; cod?: boolean } = {}) {
  const custom = plainText(p.seo?.description);
  if (custom.length >= 110) return custom;
  const sale = p.variants.filter((v) => v.availableForSale && v.price.amount > 0);
  const from = sale.length ? Math.min(...sale.map((v) => v.price.amount)) : 0;
  const bySize = [...sale].sort((a, b) => a.sizeValue - b.sizeValue);
  const sizes = bySize.map((v) => v.title);
  const lead = plainText(p.shortDescription).replace(/\.$/, "");
  const method =
    p.category === "oil"
      ? "Slow-pressed in a wooden kolhu in Rajasthan, no heat or chemicals."
      : p.category === "honey"
        ? "Raw and unheated, straight from the hive."
        : "Made the traditional way, no chemicals.";
  const perks = [
    from ? `From ₹${from.toLocaleString("en-IN")}` : "",
    sizes.length > 1 ? `${sizes[0]} to ${sizes[sizes.length - 1]}` : sizes[0] ?? "",
    opts.cod ? "COD" : "",
    opts.freeShippingThreshold ? `free shipping over ₹${opts.freeShippingThreshold.toLocaleString("en-IN")}` : "",
  ].filter(Boolean);
  const tail = `${method} ${perks.join(" · ")}.`;
  // Lead line first when it fits; the method + price line always stays whole.
  const text = lead && lead.length + tail.length + 2 <= 165 ? `${lead}. ${tail}` : tail;
  return text.length > 165 ? `${text.slice(0, 162).replace(/\s+\S*$/, "")}…` : text;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** Safe JSON-LD serialisation (escapes `<`). */
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const publisher = () => ({ "@type": "Organization", name: site.name, logo: absoluteUrl("/logo.png") });

export function articleJsonLd(a: { title: string; description: string; path: string; date?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    dateModified: a.date,
    mainEntityOfPage: absoluteUrl(a.path),
    author: { "@type": "Organization", name: site.name },
    publisher: publisher(),
    image: absoluteUrl("/logo.png"),
  };
}

export function recipeJsonLd(r: { title: string; description: string; path: string; date?: string; ingredients?: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: r.title,
    description: r.description,
    datePublished: r.date,
    author: { "@type": "Organization", name: site.name },
    image: absoluteUrl("/logo.png"),
    recipeCuisine: "Indian",
    ...(r.ingredients?.length ? { recipeIngredient: r.ingredients } : {}),
    mainEntityOfPage: absoluteUrl(r.path),
  };
}
