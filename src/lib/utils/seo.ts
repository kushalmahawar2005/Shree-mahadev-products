import type { Metadata } from "next";
import type { Product } from "@/lib/commerce/types";
import { fullAddress, site } from "@/data/site";

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}

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
      ...(image ? { images: [{ url: image }] } : {}),
    },
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
  const offers = p.variants
    .filter((v) => v.availableForSale)
    .map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      name: `${p.title} ${v.title}`,
      price: v.price.amount,
      priceCurrency: v.price.currencyCode,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/products/${p.handle}`),
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
    ...(p.rating && p.reviewCount
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
