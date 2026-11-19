import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, Tin, FlaskConical, Phone, Package, Truck, Jar, BadgeCheck } from "@/components/icons/duo";
import { BulkForm, type BulkProductGroup } from "@/components/BulkForm";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getProducts } from "@/lib/commerce";
import { site } from "@/data/site";
import { formatMoney } from "@/lib/utils/money";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Bulk & wholesale orders",
  description: "Wood-pressed oils, raw honey and jaggery in bulk: retail bottles, 5L and 15L tins, private label and regular supply for shops, restaurants and resellers.",
  path: "/bulk-orders",
});

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "").replace(/,\s*Wood-Pressed.*$/i, "");
const GROUPS: { category: string; label: string }[] = [
  { category: "oil", label: "Wood-pressed oils" },
  { category: "honey", label: "Raw honey" },
  { category: "sweetener", label: "Natural sweeteners" },
];

export default async function BulkOrdersPage() {
  const all = await getProducts();
  const products = all.filter((p) => p.category === "oil");
  const groups: BulkProductGroup[] = GROUPS.map((g) => ({ label: g.label, items: all.filter((p) => p.category === g.category).map((p) => shortTitle(p.title)) })).filter((g) => g.items.length);
  // Real tin sizes and prices straight from the catalog.
  const tins = products
    .map((p) => ({ handle: p.handle, title: shortTitle(p.title), sizes: p.variants.filter((v) => v.sizeValue >= 5000 && v.availableForSale && v.price.amount > 0) }))
    .filter((p) => p.sizes.length);

  return (
    <div className="bg-page">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-10 md:px-8 md:pt-8 md:pb-24">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Bulk orders</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          {/* Left: pitch */}
          <div>
            <p className="font-hindi text-lg text-sale" lang="hi">
              थोक में ऑर्डर
            </p>
            <h1 className="text-3xl leading-tight md:text-5xl">Bulk orders, packed your way</h1>
            <p className="mt-3 text-ink-muted md:text-lg">
              Wood-pressed oils, raw honey and jaggery for shops, restaurants, resellers and families buying in quantity. Retail bottles, 5 L and 15 L tins, or your own brand on our oil.
            </p>

            {/* TODO(client): bulk pricing slabs, minimum order and delivery areas. */}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { I: Package, t: "Any pack size", d: "500 ml & 1 L bottles, 5 L & 15 L tins" },
                { I: BadgeCheck, t: "Private / white label", d: "Our oil, your brand sticker" },
                { I: Jar, t: "Honey & jaggery too", d: "Jars, packs and loose in bulk" },
                { I: CalendarClock, t: "Regular supply", d: "Weekly or monthly, trade pricing" },
                { I: FlaskConical, t: "Lab tested batches", d: "Reports shared with every quote" },
                { I: Tin, t: "Above the website limit?", d: "Order any quantity here" },
              ].map(({ I, t, d }) => (
                <li key={t} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
                  <span className="shrink-0 text-forest">
                    <I className="size-8" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-forest-text">{t}</span>
                    <span className="block text-xs text-ink-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>

            {tins.length > 0 && (
              <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-white">
                <div className="border-b border-line px-5 py-4">
                  <h2 className="flex items-center gap-2 text-lg">
                    <Truck className="size-5 text-forest/60" /> Tin prices
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-muted">Retail price before bulk discount. Bottle and private-label rates come with your quote.</p>
                </div>
                <ul className="divide-y divide-line">
                  {tins.map((p) => (
                    <li key={p.handle} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <Link href={`/products/${p.handle}`} className="font-semibold text-ink hover:text-forest">
                        {p.title}
                      </Link>
                      <span className="flex flex-wrap gap-2">
                        {p.sizes.map((v) => (
                          <span key={v.id} className="rounded-full bg-subtle px-3 py-1 text-xs tabular-nums">
                            <span className="font-semibold text-forest-text">{v.title}</span> · {formatMoney(v.price)}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-forest-text">
              <Phone className="size-4" /> Our team calls you back on the number you share · {site.supportHours}
            </p>
          </div>

          {/* Right: form */}
          <div className="h-fit rounded-3xl border border-line bg-white p-5 shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)] md:p-8 lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)]">
            <h2 className="text-2xl">Get a bulk quote</h2>
            <p className="mt-1 text-sm text-ink-muted">Tell us what you need. Our team calls you back with prices, MOQ and delivery within a working day.</p>
            {/* Suspense: the form reads ?product=&qty= (prefill from the per-order limit note). */}
            <Suspense fallback={<div className="mt-5 h-[560px] animate-pulse rounded-2xl bg-subtle" />}>
              <BulkForm groups={groups} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
