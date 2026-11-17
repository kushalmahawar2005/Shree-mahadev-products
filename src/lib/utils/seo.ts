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
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
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
      type: "website",
      // A page-level openGraph replaces the layout's, so always carry an image (own photo or the default card).
      images: image ? [{ url: image }] : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: site.name }],
    },
    twitter: { card: "summary_large_image", images: [image ?? DEFAULT_OG_IMAGE] },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: absoluteUrl("/logo.png"),
    email: site.email,
    telephone: site.phone,
    sameAs: site.socials.map((s) => s.href),
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: site.name,
    url: site.url,
    image: absoluteUrl("/logo.png"),
    telephone: site.phone,
    email: site.email,
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

export function productJsonLd(p: Product) {
  // Every size, with its real stock state: a sold-out product still has valid offers (OutOfStock)
  // instead of none, which made the Product invalid for Google rich results.
  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    sku: v.sku,
    name: `${p.title} ${v.title}`,
    price: v.price.amount,
    priceCurrency: v.price.currencyCode,
    availability: v.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    url: absoluteUrl(`/products/${p.handle}`),
    seller: { "@type": "Organization", name: site.name },
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    alternateName: p.titleHi,
    description: p.shortDescription,
    image: p.images.map((i) => absoluteUrl(i.url)),
    brand: { "@type": "Brand", name: site.name },
    ...(offers.length ? { offers } : {}),
    // Only when the page itself shows the rating (5+ reviews): markup must match visible content.
    ...(p.rating && showRating(p.reviewCount)
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.rating,
            reviewCount: p.reviewCount,
          },
        }
      : {}),
  };
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
