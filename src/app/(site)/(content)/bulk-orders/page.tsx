import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Container as Tin, FlaskConical, Phone, Store, Truck } from "lucide-react";
import { BulkForm } from "@/components/BulkForm";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getProducts } from "@/lib/commerce";
import { site } from "@/data/site";
import { formatMoney } from "@/lib/utils/money";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Bulk orders: 5L & 15L tins",
  description: "Wood-pressed oil in 5L and 15L tins for restaurants, caterers and retailers. Send an inquiry on WhatsApp.",
  path: "/bulk-orders",
});

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

export default async function BulkOrdersPage() {
  const products = await getProducts({ collection: "wood-pressed-oils" });
  // Real tin sizes and prices straight from the catalog.
  const tins = products
    .map((p) => ({ handle: p.handle, title: shortTitle(p.title), sizes: p.variants.filter((v) => v.sizeValue >= 5000 && v.availableForSale && v.price.amount > 0) }))
    .filter((p) => p.sizes.length);

  return (
    <div className="bg-[#F5EDDE]">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 md:px-8 md:pt-8 md:pb-24">
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
            <h1 className="text-3xl leading-tight md:text-5xl">Kachi ghani oil, by the tin</h1>
            <p className="mt-3 text-ink-muted md:text-lg">For restaurants, caterers, sweet shops and retailers. 5 L and 15 L tins, with regular supply on request.</p>

            {/* TODO(client): bulk pricing slabs, minimum order and delivery areas. */}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { I: Tin, t: "5 L & 15 L tins", d: "Sealed tins for kitchens and shops" },
                { I: CalendarClock, t: "Regular supply", d: "Weekly or monthly, on request" },
                { I: FlaskConical, t: "Lab tested batches", d: "Reports shared on request" },
                { I: Store, t: "Resellers welcome", d: "Ask about trade pricing" },
              ].map(({ I, t, d }) => (
                <li key={t} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest">
                    <I className="size-5" />
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
                <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-lg">
                  <Truck className="size-5 text-forest/60" /> Tin prices <span className="text-xs font-normal text-ink-muted">(retail, before bulk discount)</span>
                </h2>
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

            <a href={site.phoneHref} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-forest-text hover:text-forest">
              <Phone className="size-4" /> Prefer a call? {site.phone} · {site.supportHours}
            </a>
          </div>

          {/* Right: form */}
          <div className="h-fit rounded-3xl border border-line bg-white p-5 shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)] md:p-8 lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)]">
            <h2 className="text-2xl">Send an inquiry</h2>
            <p className="mt-1 text-sm text-ink-muted">We save it for our team and open WhatsApp with your details filled in. Replies within a working day.</p>
            <BulkForm products={products.map((p) => shortTitle(p.title))} />
          </div>
        </div>
      </div>
    </div>
  );
}
