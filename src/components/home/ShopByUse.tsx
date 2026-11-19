"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Amphora, ArrowRight, Baby as BabyLine, ChevronLeft, ChevronRight, Flame as FlameLine, Flower2, Soup, type LucideIcon } from "lucide-react";
import { Baby, BowlSteam, Flame, Jar, Lightbulb, Lotus } from "@/components/icons/duo";
import { cn } from "@/lib/utils/cn";
import { PickCard, type PickProduct } from "./PickCard";
import { TornEdge } from "@/components/ui/TornEdge";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/shadcn/carousel";

export type UseTab = {
  key: string;
  label: string;
  labelHi: string;
  note: string;
  tip: string;
  scene: { src: string; portraitSrc: string; alt: string; tone: string };
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
  const { tone } = tab.scene;

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
  // Scrolls only the tab row sideways. scrollIntoView would also scroll the page, and it
  // re-ran after mount when `reduce` resolved, dragging the home page down to this section.
  const shownTab = useRef(active);
  useEffect(() => {
    if (shownTab.current === active) return;
    shownTab.current = active;
    const tab = tabRefs.current[active];
    const row = tab?.closest<HTMLElement>(".overflow-x-auto");
    if (!tab || !row) return;
    const tabBox = tab.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const left = row.scrollLeft + (tabBox.left - rowBox.left) - (row.clientWidth - tabBox.width) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
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
                    <span className={cn("relative shrink-0 transition-colors duration-150", on ? "text-co-gold" : "text-forest")}>
                      <I strokeWidth={1.75} className={cn("size-4 md:size-6", on ? "fill-co-gold/20" : "fill-[#E9D29A]/60")} />
                    </span>
                    <span className="relative leading-tight">
                      <span className={cn("block text-[12px] font-semibold whitespace-nowrap transition-colors md:text-sm md:font-bold", on ? "text-white" : "text-forest-text")}>{t.label}</span>
                      <span className={cn("font-hindi block text-[13px] whitespace-nowrap transition-colors max-md:hidden", on ? "text-co-gold" : "text-sale")} lang="hi">
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.aside
              key={tab.key}
              {...swap}
              className="relative isolate flex w-full min-w-0 overflow-hidden rounded-3xl text-white [background-color:var(--scene-tone)] max-[520px]:aspect-[4/3] max-[520px]:items-end max-[520px]:gap-3 max-[520px]:p-3 min-[520px]:flex-col min-[520px]:justify-between min-[520px]:max-lg:aspect-[25/12] min-[520px]:max-lg:min-h-[16rem] lg:min-h-[34rem]"
              style={{
                "--scene-tone": tone,
                "--scene-shade-mobile": `linear-gradient(0deg, ${tone}eb 0%, ${tone}9c 17%, transparent 42%)`,
                "--scene-shade": `linear-gradient(180deg, ${tone}80 0%, ${tone}70 23%, ${tone}25 34%, transparent 44%, transparent 78%, ${tone}d9 100%)`,
                "--scene-shade-wide": `linear-gradient(90deg, ${tone} 0%, ${tone} 34%, ${tone}cc 42%, transparent 54%)`,
              } as CSSProperties}
            >
              <picture className="pointer-events-none absolute inset-0 min-[520px]:max-lg:left-[36%]">
                <source media="(width < 64rem)" srcSet={tab.scene.src} type="image/webp" />
                <Image
                  src={tab.scene.portraitSrc}
                  alt={tab.scene.alt}
                  fill
                  unoptimized
                  className="object-cover lg:object-top"
                />
              </picture>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 max-[520px]:[background:var(--scene-shade-mobile)] min-[520px]:max-lg:[background:var(--scene-shade-wide)] lg:[background:var(--scene-shade)]"
              />
              <div className="relative [text-shadow:0_1px_6px_rgb(0_0_0/0.5)] min-[520px]:px-4 min-[520px]:pt-4 min-[520px]:max-lg:max-w-[46%] sm:px-6 sm:pt-6">
                <div className="flex items-center gap-2.5">
                  <span className="hidden shrink-0 text-co-gold min-[520px]:block">
                    <Icon className="size-5 sm:size-6" />
                  </span>
                  <p className="font-hindi min-w-0 text-[13px] leading-snug text-co-gold sm:text-[15px] lg:text-base" lang="hi">
                    {tab.labelHi}
                  </p>
                </div>
                <h3 className="mt-1.5 text-[21px] leading-tight text-white max-[520px]:mt-1 max-[520px]:text-lg sm:text-xl md:text-3xl">{tab.label}</h3>
                <p className="mt-1 hidden text-[12px] text-white/80 min-[520px]:block sm:text-sm">{tab.note}</p>
                <p className="mt-2 hidden gap-2 rounded-xl border border-white/25 bg-transparent px-2.5 py-2 text-[12px] leading-snug text-white min-[520px]:flex sm:mt-2.5 sm:gap-2.5 sm:rounded-2xl sm:px-3 sm:text-sm sm:leading-relaxed">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-co-gold" aria-hidden />
                  {tab.tip}
                </p>
              </div>

              <div className="relative max-[520px]:shrink-0 min-[520px]:px-4 min-[520px]:pt-2.5 min-[520px]:pb-4 sm:px-6 sm:pb-5">
                <Link
                  href={tab.viewAll}
                  className="btn-shine inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-full bg-co-gold px-4 py-2 text-[13px] font-bold text-forest-deep transition-colors hover:bg-white max-[520px]:px-3 max-[520px]:text-xs sm:px-5 sm:text-sm"
                >
                  <span>Shop all<span className="max-[520px]:sr-only"> for {tab.label.toLowerCase()}</span></span>
                  <ArrowRight className="size-4 shrink-0" />
                </Link>
              </div>
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
