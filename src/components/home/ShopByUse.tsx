"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Amphora, ArrowRight, Baby as BabyLine, ChevronLeft, ChevronRight, Flame as FlameLine, Flower2, Soup, type LucideIcon } from "lucide-react";
import { Baby, BowlSteam, Flame, Jar, Lightbulb, Lotus } from "@/components/icons/duo";
import { cn } from "@/lib/utils/cn";
import { PickCard, type PickProduct } from "./PickCard";
import { deco } from "@/data/brand-art";
import { TornEdge } from "@/components/ui/TornEdge";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/shadcn/carousel";

export type UseTab = {
  key: string;
  label: string;
  labelHi: string;
  note: string;
  tip: string;
  viewAll: string;
  products: PickProduct[];
};

/** Tab bar icons: one lucide outline set, same size + stroke, light tan fill (see TAB_ICON_CLASS). */
const TAB_ICONS: Record<string, LucideIcon> = {
  "daily-cooking": Soup,
  "deep-frying": FlameLine,
  "pickles-tadka": Amphora,
  "hair-skin": Flower2,
  "baby-massage": BabyLine,
};

const ICONS: Record<string, typeof Flame> = {
  "daily-cooking": BowlSteam,
  "deep-frying": Flame,
  "pickles-tadka": Jar,
  "hair-skin": Lotus,
  "baby-massage": Baby,
};

/**
 * "Shop by use": large icon cards pick the use; a forest story panel explains it (Hindi name,
 * kitchen tip) next to that use's products, which slide in. Mobile: chips scroll, panel stacks.
 */
export function ShopByUse({ tabs }: { tabs: UseTab[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const tab = tabs[active];
  const Icon = ICONS[tab.key] ?? BowlSteam;

  // Embla carousel (shadcn). It remounts per tab (keyed), so every tab starts at the first card.
  const [api, setApi] = useState<CarouselApi>();
  const [edge, setEdge] = useState({ prev: false, next: false });
  useEffect(() => {
    if (!api) return;
    const update = () => setEdge({ prev: api.canScrollPrev(), next: api.canScrollNext() });
    update();
    api.on("select", update).on("reInit", update);
    return () => {
      api.off("select", update).off("reInit", update);
    };
  }, [api]);

  // Phones: keep the active tab in view in the scrolling tab row (not on first paint).
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    tabRefs.current[active]?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce]);

  const swap = reduce
    ? {}
    : {
        initial: { opacity: 0, x: 16 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -16 },
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
      };

  const arrow = "grid size-11 place-items-center rounded-full border border-line bg-white/90 text-forest-text shadow-[0_10px_24px_-12px_rgba(7,47,27,0.45)] transition-[opacity,transform] duration-300 hover:scale-105 disabled:pointer-events-none disabled:opacity-35";

  return (
    <section className="paper-grain relative overflow-hidden bg-[linear-gradient(180deg,#e9edd2_0%,#dfe5c3_100%)] pt-10 pb-10 md:pt-20 md:pb-24">
      {/* Soft sage band between the forest film band and the haldi proof band */}
      <TornEdge color="var(--color-forest-deep)" />
      <TornEdge flip color="#f8e8bb" />
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <div className="mb-5 flex flex-col items-center text-center md:mb-10">
          <p className="font-hindi flex items-center gap-2 text-base text-sale md:text-lg" lang="hi">
            <span aria-hidden className="h-px w-6 bg-sale/50" />
            हर पकवान का अपना तेल
            <span aria-hidden className="h-px w-6 bg-sale/50" />
          </p>
          <h2 className="mt-1.5 text-[24px] leading-[1.1] font-bold tracking-tight md:mt-2 md:text-[44px]">Shop by use</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-muted md:mt-3 md:text-base">Tell us what you&apos;re cooking. We&apos;ll show the oil that suits it.</p>
        </div>

        {/* Use picker (centre) + carousel arrows (right, desktop). Phones: the tab row scrolls with snap. */}
        <div className="lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <span aria-hidden className="hidden lg:block" />
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 justify-start overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:justify-center md:px-0">
            <div role="tablist" aria-label="Shop by use" className="flex w-max flex-nowrap gap-2 md:grid md:grid-cols-5 md:gap-1 md:rounded-full md:bg-white/75 md:p-1.5 md:shadow-[0_1px_2px_rgba(7,47,27,0.06)] md:backdrop-blur">
              {tabs.map((t, i) => {
                const I = TAB_ICONS[t.key] ?? Soup;
                const on = i === active;
                return (
                  <button
                    key={t.key}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    role="tab"
                    type="button"
                    aria-selected={on}
                    onClick={() => setActive(i)}
                    className={cn(
                      "relative flex h-8 snap-start items-center gap-1.5 rounded-full border px-3 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 md:h-auto md:justify-center md:gap-2.5 md:border-0 md:bg-transparent md:px-5 md:py-3",
                      on ? "border-transparent" : "border-line bg-white/70 hover:bg-forest/5 md:hover:bg-forest/5",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId="use-pill"
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-forest ring-2 ring-[#E9D29A]/40"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className={cn("relative shrink-0 transition-colors duration-150", on ? "text-[#e8c879]" : "text-forest")}>
                      <I strokeWidth={1.75} className={cn("size-4 md:size-6", on ? "fill-[#e8c879]/20" : "fill-[#E9D29A]/60")} />
                    </span>
                    <span className="relative leading-tight">
                      <span className={cn("block text-[12px] font-semibold whitespace-nowrap transition-colors md:text-sm md:font-bold", on ? "text-white" : "text-forest-text")}>{t.label}</span>
                      <span className={cn("font-hindi block text-[13px] whitespace-nowrap transition-colors max-md:hidden", on ? "text-[#e8c879]" : "text-sale")} lang="hi">
                        {t.labelHi}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hidden justify-end gap-2 lg:flex">
            <button type="button" aria-label="Previous products" disabled={!edge.prev} onClick={() => api?.scrollPrev()} className={arrow}>
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" aria-label="More products" disabled={!edge.next} onClick={() => api?.scrollNext()} className={arrow}>
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-[320px_1fr] lg:gap-5">
          {/* Phones: one slim tip row + "See all" instead of the big panel (the chip already names the use). */}
          <div className="flex items-start gap-2 rounded-2xl bg-white/60 px-3 py-2.5 sm:hidden">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#b07a10]" aria-hidden />
            <p className="flex-1 text-[12px] leading-snug text-ink">{tab.tip}</p>
            <Link href={tab.viewAll} className="shrink-0 text-[12px] font-semibold whitespace-nowrap text-forest underline-offset-2 hover:underline">
              See all
            </Link>
          </div>

          {/* Story panel: crossfades + slides on tab change (sm+) */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.aside
              key={tab.key}
              {...swap}
              className="relative flex flex-col overflow-hidden rounded-3xl bg-forest p-3.5 text-white max-sm:hidden sm:p-6"
            >
              {/* soft lamp-light in the panel corner */}
              <span aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-[radial-gradient(closest-side,rgba(232,200,121,0.18),transparent)]" />
              {/* Phone: one slim row (icon · name + use · arrow). sm+: the full stacked card. */}
              <div className="relative flex items-center gap-3 lg:block">
                <span className="shrink-0 text-[#e8c879]">
                  <Icon className="size-8 lg:size-9" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-hindi text-[15px] leading-tight text-[#e8c879] max-sm:hidden lg:mt-5 lg:text-lg" lang="hi">
                    {tab.labelHi}
                  </p>
                  <h3 className="text-lg leading-tight text-white sm:text-xl md:text-3xl">{tab.label}</h3>
                  <p className="mt-0.5 truncate text-[12px] text-white/65 sm:hidden">{tab.note}</p>
                </div>
                <Link
                  href={tab.viewAll}
                  aria-label={`Shop all for ${tab.label.toLowerCase()}`}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e8c879] text-forest-deep transition-colors hover:bg-white sm:hidden"
                >
                  <ArrowRight className="size-[18px]" />
                </Link>
              </div>
              <p className="relative mt-1 text-sm text-white/70 max-sm:hidden">{tab.note}</p>
              {/* Tip sits right under the subtitle; the kadhai below grows to fill the rest of the panel */}
              <p className="relative mt-3 flex gap-2 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-white/80 sm:mt-6 sm:gap-2.5 sm:rounded-2xl sm:border-0 sm:bg-white/10 sm:p-3.5 sm:text-sm sm:text-white/90">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#e8c879]" aria-hidden />
                {tab.tip}
              </p>
              {/* Painted brass kadhai + masala bowls, right above the CTA (desktop) */}
              <div aria-hidden className="pointer-events-none relative mt-4 hidden min-h-[120px] flex-1 lg:block">
                <Image
                  src={deco.rasoiSet.src}
                  alt=""
                  fill
                  sizes="320px"
                  className="object-contain object-bottom drop-shadow-[0_16px_24px_rgba(0,0,0,0.35)]"
                />
              </div>
              <Link
                href={tab.viewAll}
                className="btn-shine relative mt-6 hidden h-11 items-center justify-center gap-2 self-start overflow-hidden rounded-full bg-[#e8c879] px-5 text-sm font-bold text-forest-deep transition-colors hover:bg-white sm:inline-flex lg:mt-5"
              >
                Shop all for {tab.label.toLowerCase()} <ArrowRight className="size-4" />
              </Link>
            </motion.aside>
          </AnimatePresence>

          {/* Products for this use: Embla carousel, swipe/drag, snap; right edge fades while more is left */}
          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab.key} {...swap}>
                {tab.products.length === 0 ? (
                  <p className="grid w-full place-items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-sm text-ink-muted">Products for this use are coming soon.</p>
                ) : (
                  <Carousel
                    setApi={setApi}
                    opts={{ align: "start", containScroll: "trimSnaps", dragFree: false }}
                    className={cn(
                      "-mx-4 px-4 lg:mx-0 lg:px-0",
                      edge.next && "lg:[&_[data-slot=carousel-content]]:[mask-image:linear-gradient(to_right,black_calc(100%-28px),rgb(0_0_0/0.35))]",
                    )}
                  >
                    <CarouselContent className="-ml-3 md:-ml-4">
                      {tab.products.map((p) => (
                        <CarouselItem key={`${tab.key}-${p.handle}`} className="basis-[46%] pl-3 sm:basis-[32%] md:pl-4 lg:basis-[30%]">
                          <PickCard product={p} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
