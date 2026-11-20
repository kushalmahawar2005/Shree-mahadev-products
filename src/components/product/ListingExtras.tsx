import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { BadgeCheck, Factory, FlaskConical, Leaf, ThermometerSnowflake } from "@/components/icons/duo";
import { shopByUse } from "@/data/site";
import { getCollection, getCollections } from "@/lib/commerce";
import type { Collection, Product } from "@/lib/commerce/types";
import { absoluteUrl, jsonLdString } from "@/lib/utils/seo";
import { cn } from "@/lib/utils/cn";

/* Server-rendered pieces around the shop / collection grid. Copy is factual (no health claims). */

export function TrustRow() {
  const items = [
    { Icon: Factory, label: "Wood-pressed" },
    { Icon: FlaskConical, label: "Lab tested" },
    { Icon: BadgeCheck, label: "FSSAI licensed" },
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted md:mt-3 md:gap-x-5 md:gap-y-2 md:text-sm">
      {items.map(({ Icon, label }) => (
        <li key={label} className="flex items-center gap-1.5">
          <Icon className="size-4 md:size-5" /> {label}
        </li>
      ))}
    </ul>
  );
}

/** Shop all + sibling collections as pills with counts; the current one highlighted. */
export async function CategoryPills({ current, total }: { current: string; total: number }) {
  const list = await getCollections();
  const full = await Promise.all(list.filter((c) => c.inMenu !== false).map((c) => getCollection(c.handle)));
  const items = [{ href: "/shop", key: "shop", label: "Shop all", n: total }].concat(
    full
      .filter((c): c is Collection => Boolean(c && c.products.length))
      .map((c) => ({ href: `/collections/${c.handle}`, key: c.handle, label: c.title, n: c.products.length })),
  );
  return (
    <nav aria-label="Categories" className="-mx-4 mt-3 overflow-x-auto max-md:contents px-4 [mask-image:linear-gradient(90deg,#000_85%,transparent)] [scrollbar-width:none] md:mx-0 md:mt-5 md:px-0 md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-2 max-md:contents">
        {items.map((c) => {
          const on = c.key === current;
          return (
            <li key={c.key} className="shrink-0">
              <Link
                href={c.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors md:h-10 md:gap-2 md:px-4 md:text-sm",
                  on ? "border-forest bg-forest text-white" : "border-line bg-white text-forest-text hover:border-forest/40",
                )}
              >
                {c.label}
                <span className={cn("text-xs tabular-nums", on ? "text-white/70" : "text-ink-muted")}>{c.n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Phones: categories + "shop by use" share ONE swipe row (the two components render as
 * display:contents inside this rail). md+: the rail is a plain block and they stack as before.
 */
export function ChipRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-md:no-scrollbar max-md:-mx-4 max-md:mt-3 max-md:flex max-md:items-center max-md:gap-2 max-md:overflow-x-auto max-md:px-4 max-md:[mask-image:linear-gradient(90deg,#000_88%,transparent)] max-md:[scrollbar-width:none]">
      {children}
    </div>
  );
}

/** "Shop by use" quick filters (same tags as the homepage tabs). Only uses that exist in this listing. */
export function UseChips({ path, products }: { path: string; products: Product[] }) {
  const uses = shopByUse.filter((u) => products.some((p) => p.tags.includes(u.tag)));
  if (!uses.length) return null;
  return (
    <div className="mt-2 max-md:contents md:mt-3">
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] max-md:contents md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <span aria-hidden className="my-1.5 w-px shrink-0 self-stretch bg-line md:hidden" />
      <span className="hidden shrink-0 text-xs font-semibold text-ink-muted md:inline">Shop by use</span>
      {uses.map((u) => (
        <Link
          key={u.tag}
          href={`${path}?use=${u.tag}`}
          scroll={false}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-[13px] font-semibold text-forest-text md:h-10 md:gap-1.5 md:px-4 md:text-sm shadow-[0_1px_2px_rgba(0,0,0,.05)] transition-colors hover:border-forest hover:bg-co-brand-soft active:scale-[0.98]"
        >
          <Plus className="size-3.5 text-forest" aria-hidden />
          {u.label}
          <span className="font-hindi text-[11px] font-normal text-co-accent-ink md:text-xs" lang="hi">
            {u.labelHi}
          </span>
        </Link>
      ))}
    </div>
    </div>
  );
}

type Copy = { seo: string; faqs: { q: string; a: string }[] };
const COPY: Record<string, Copy> = {
  default: {
    seo: "Our kachi ghani oils are pressed slowly in a wooden ghani in Bijainagar, Rajasthan, without heat or chemical refining, then filtered and bottled. Raw honey and desi sweeteners come from the same family workshop. Every batch is tested before it is packed.",
    faqs: [
      { q: "What does wood-pressed (kachi ghani) mean?", a: "Seeds are crushed slowly in a wooden ghani at low speed, so the oil is not heated or chemically refined. It keeps its natural colour, aroma and taste." },
      { q: "How should I store the oil?", a: "Keep the bottle tightly closed in a cool, dark place, away from the stove and direct sunlight. Natural sediment at the bottom is normal." },
      { q: "Why does the oil look cloudy in winter?", a: "Unrefined oils can thicken or turn cloudy in the cold. Keep the bottle at room temperature for a while and it clears again." },
    ],
  },
  honey: {
    seo: "Raw honey, strained and bottled without heating or added sugar. Its colour and taste change a little with the season and the flowers the bees visit.",
    faqs: [
      { q: "Why has my honey crystallised?", a: "Raw honey naturally crystallises over time, faster in cold weather. Place the jar in warm (not hot) water and stir; it turns liquid again." },
      { q: "How should I store honey?", a: "Close the lid tightly and keep it at room temperature, away from moisture. Use a dry spoon." },
    ],
  },
  sweetener: {
    seo: "Desi jaggery and khand made from sugarcane juice the traditional way, without chemical clarifiers.",
    faqs: [
      { q: "How should I store jaggery?", a: "Keep it in an airtight container in a dry place. In humid weather it can soften; that is normal for unrefined jaggery." },
    ],
  },
};
const copyFor = (handle: string) =>
  handle.includes("honey") ? COPY.honey! : handle.includes("sweet") || handle.includes("jaggery") ? COPY.sweetener! : COPY.default!;

/** Why wood-pressed strip + collapsible SEO text + collection FAQ (with FAQPage JSON-LD). */
export function BelowGrid({ handle, title }: { handle: string; title: string }) {
  const c = copyFor(handle);
  const why = [
    { Icon: Factory, title: "Slow wooden ghani", text: "Pressed at low speed, so the oil isn't heated." },
    { Icon: ThermometerSnowflake, title: "No refining", text: "No chemicals, bleaching or deodorising." },
    { Icon: Leaf, title: "Fresh batches", text: "Pressed and packed in small lots." },
  ];
  return (
    <div className="mt-10 space-y-5 md:mt-14 md:space-y-10">
      <section aria-labelledby="why-h" className="rounded-3xl bg-white p-4 ring-1 ring-line md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="why-h" className="text-lg md:text-2xl">
            Why wood-pressed?
          </h2>
          <Link href="/our-ghani" className="text-sm font-semibold text-forest hover:underline">
            See our ghani →
          </Link>
        </div>
        {/* Phones: three small tiles in one row (icon + name); md+: icon, name and line. */}
        <ul className="mt-3 grid grid-cols-3 gap-2 md:mt-5 md:gap-5">
          {why.map(({ Icon, title: t, text }) => (
            <li key={t} className="flex flex-col items-center gap-1.5 rounded-2xl bg-co-brand-soft/60 px-1.5 py-3 text-center md:flex-row md:items-start md:gap-3 md:bg-transparent md:p-0 md:text-left">
              <Icon className="size-7 shrink-0 md:size-8" />
              <div>
                <p className="text-[12.5px] leading-tight font-semibold text-forest-text md:text-base">{t}</p>
                <p className="hidden text-sm text-ink-muted md:block">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* items-start: the closed "About" card keeps its own height instead of stretching to the FAQ box. */}
      <div className="grid items-start gap-3 md:gap-8 lg:grid-cols-2">
        <details className="group rounded-2xl bg-white p-5 ring-1 ring-line md:p-6">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3 font-semibold text-forest-text">
              About our {title.toLowerCase()}
              <ChevronDown className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
            </span>
            {/* Closed: a two-line taste of the text and a "Read more" cue; open: the full text below. */}
            <span className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted group-open:hidden">{c.seo}</span>
            <span className="mt-1.5 inline-block text-sm font-semibold text-forest group-open:hidden">Read more</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{c.seo}</p>
        </details>

        <section aria-labelledby="cfaq-h" className="rounded-2xl bg-white p-5 ring-1 ring-line md:p-6">
          <h2 id="cfaq-h" className="font-semibold text-forest-text">
            Questions
          </h2>
          <div className="mt-2 divide-y divide-line">
            {c.faqs.map((f) => (
              <details key={f.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLdString({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
              }),
            }}
          />
        </section>
      </div>
    </div>
  );
}

/** ItemList JSON-LD for the listing (product rich data lives on each product page). */
export function ItemListJsonLd({ products }: { products: Product[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLdString({
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: products.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(`/products/${p.handle}`),
            name: p.title,
          })),
        }),
      }}
    />
  );
}
