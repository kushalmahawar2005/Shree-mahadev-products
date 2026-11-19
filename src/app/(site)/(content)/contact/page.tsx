import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ShoppingBag } from "lucide-react";
import { Clock, Mail, MapPin, Package, Phone, Truck } from "@/components/icons/duo";
import { WhatsAppIcon } from "@/components/layout/icons";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { fullAddress, site, whatsappLink } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: `Contact Swadeshi Mahadev Products (${site.supportHours}). ${fullAddress}.`,
  path: "/contact",
});

const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Mahadev Products, ${fullAddress}`)}`;

export default function ContactPage() {
  const channels = [
    {
      icon: WhatsAppIcon,
      title: "WhatsApp",
      hint: "Fastest reply. Orders, questions, bulk.",
      value: site.phone,
      href: whatsappLink("Hi, I have a question."),
      cta: "Start chat",
      external: true,
      featured: true,
    },
    { icon: Phone, title: "Call us", hint: `${site.supportHours}`, value: site.phone, href: site.phoneHref, cta: "Call now" },
    { icon: Mail, title: "Email", hint: "We reply within a working day.", value: site.email, href: `mailto:${site.email}`, cta: "Write to us" },
  ];

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
              <BreadcrumbPage>Contact us</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="mt-6 max-w-2xl">
          <p className="font-hindi text-lg text-sale" lang="hi">
            हम से बात करें
          </p>
          <h1 className="text-3xl md:text-5xl">We&apos;re a message away</h1>
          {/* TODO(client): confirm working days. */}
          <p className="mt-3 text-ink-muted md:text-lg">A small family team in Bijainagar. Real people answer, {site.supportHours}.</p>
        </header>

        {/* Channels */}
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {channels.map((c) => {
            const I = c.icon;
            return (
              <li key={c.title}>
                <a
                  href={c.href}
                  {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={
                    c.featured
                      ? "group relative flex h-full flex-col overflow-hidden rounded-3xl bg-forest p-6 text-white shadow-[0_24px_48px_-32px_rgba(7,47,27,0.8)]"
                      : "group flex h-full flex-col rounded-3xl border border-line bg-white p-6 transition-colors hover:border-forest/30"
                  }
                >
                  <span className={`relative ${c.featured ? "text-[#e8c879]" : "text-forest"}`}>
                    <I className="size-10" />
                  </span>
                  <span className={`relative mt-5 text-lg font-bold ${c.featured ? "text-white" : "text-forest-text"}`}>{c.title}</span>
                  <span className={`relative mt-0.5 text-sm ${c.featured ? "text-white/70" : "text-ink-muted"}`}>{c.hint}</span>
                  <span className={`relative mt-4 break-all font-semibold ${c.featured ? "text-white" : "text-ink"}`}>{c.value}</span>
                  <span className={`relative mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold ${c.featured ? "text-[#e8c879]" : "text-forest"}`}>
                    {c.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        {/* Visit + hours */}
        <div className="mt-4 grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <section className="flex flex-col rounded-3xl border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 text-xl">
              <MapPin className="size-5 text-forest/60" /> Our ghani
            </h2>
            <address className="mt-3 text-ink not-italic md:text-lg">{fullAddress}</address>
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-11 items-center gap-2 self-start rounded-full border border-line px-5 text-sm font-semibold text-forest-text transition-colors hover:border-forest hover:bg-forest hover:text-white"
            >
              Open in Google Maps <ArrowUpRight className="size-4" />
            </a>
          </section>
          <section className="rounded-3xl border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 text-xl">
              <Clock className="size-5 text-forest/60" /> Hours
            </h2>
            <p className="mt-3 text-3xl font-extrabold text-forest tabular-nums">{site.supportHours}</p>
            <p className="mt-1 text-sm text-ink-muted">Messages after hours are answered the next morning.</p>
          </section>
        </div>

        {/* Quick help */}
        <section className="mt-10">
          <h2 className="text-2xl">Looking for something quick?</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { I: Truck, t: "Track your order", d: "Status and courier updates", href: "/track-order" },
              { I: Package, t: "Bulk & business orders", d: "Shops, caterers, gifting", href: "/bulk-orders" },
              { I: ShoppingBag, t: "Questions about products", d: "Read our FAQ", href: "/faq" },
            ].map(({ I, t, d, href }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-line bg-white/70 p-4 transition-colors hover:border-forest/30 hover:bg-white">
                  <span className="shrink-0 text-forest">
                    <I className="size-8" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-forest-text">{t}</span>
                    <span className="block text-xs text-ink-muted">{d}</span>
                  </span>
                  <ArrowRight className="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-forest" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
