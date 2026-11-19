import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { MapPin } from "@/components/icons/duo";
import { Reveal } from "@/components/motion/Reveal";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { FactsStrip, FilmFrame, NeverDo, StoryCta } from "@/components/story/StoryBits";
import { fullAddress } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "About us",
  description: "The family behind Swadeshi Mahadev Products and our kachi ghani in Bijainagar, Rajasthan.",
  path: "/about",
});

// TODO(client): founder story, mission in their words, founder name + photo.
// Fill `founder` and the section renders; while it's null nothing placeholder-y reaches customers.
const founder: { name: string; role: string; quote: string[] } | null = null;

const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Mahadev Products, ${fullAddress}`)}`;

export default function AboutPage() {
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
              <BreadcrumbPage>About us</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero */}
        <section className="mt-6 grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
          <div>
            <p className="font-hindi text-lg text-sale" lang="hi">
              स्वदेशी · धीमी घाणी
            </p>
            <h1 className="text-4xl leading-[1.05] md:text-6xl">From Bijainagar, with patience</h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-muted">
              Swadeshi Mahadev Products is a small kachi ghani unit in Bijainagar, in the Beawar district of Rajasthan. We press oil in a wooden ghani, the way it was done before refineries, and
              bottle raw honey and natural sweeteners alongside it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/our-ghani" className="btn-shine inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-forest-mid">
                How we press <ArrowRight className="size-4" />
              </Link>
              <Link href="/shop" className="inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-semibold text-forest-text hover:border-forest/40">
                Shop the range
              </Link>
            </div>
          </div>
          <FilmFrame className="aspect-[4/3] shadow-[0_40px_80px_-50px_rgba(7,47,27,0.8)]" />
        </section>

        <div className="mt-10">
          <FactsStrip />
        </div>

        {founder && (
          <Reveal className="mt-10 md:mt-14 grid gap-6 rounded-3xl border border-line bg-white p-6 md:grid-cols-[auto_1fr] md:p-10">
            <span className="grid size-16 place-items-center rounded-full bg-forest text-2xl font-extrabold text-[#e8c879]">{founder.name[0]}</span>
            <div>
              <h2 className="text-2xl md:text-3xl">A note from our ghani</h2>
              <blockquote className="mt-4 space-y-3 text-lg leading-relaxed text-ink">
                {founder.quote.map((q) => (
                  <p key={q}>{q}</p>
                ))}
              </blockquote>
              <p className="mt-5 font-bold text-forest-text">{founder.name}</p>
              <p className="text-sm text-ink-muted">{founder.role}</p>
            </div>
          </Reveal>
        )}

        {/* Promise */}
        <Reveal className="mt-10 md:mt-14 grid gap-8 rounded-3xl bg-forest p-6 text-white md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e8c879] uppercase">Our promise</p>
            <h2 className="mt-2 text-3xl text-white md:text-4xl">What we never do</h2>
            <p className="mt-3 text-white/70">A wooden ghani gives less oil and takes longer. We accept that, so the oil keeps the taste and smell of the seed.</p>
          </div>
          <NeverDo />
        </Reveal>

        {/* Visit */}
        <Reveal className="mt-10 md:mt-14 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <section className="rounded-3xl border border-line bg-white p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-2xl">
              <MapPin className="size-5 text-forest/60" /> Visit us
            </h2>
            <address className="mt-3 text-lg text-ink not-italic">{fullAddress}</address>
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold text-forest-text hover:border-forest hover:bg-forest hover:text-white"
            >
              Open in Google Maps <ArrowUpRight className="size-4" />
            </a>
          </section>
          <Link href="/contact" className="group flex flex-col justify-between rounded-3xl border border-line bg-white p-6 transition-colors hover:border-forest/30 md:p-8">
            <h2 className="text-2xl">Talk to us</h2>
            <p className="mt-2 text-ink-muted">Questions about a product, a bulk order or your delivery.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-forest">
              Contact options <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </Reveal>

        <div className="mt-10 md:mt-14">
          <StoryCta />
        </div>
      </div>
    </div>
  );
}
