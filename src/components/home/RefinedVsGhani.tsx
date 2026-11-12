"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronsLeftRight, Factory, FlaskConical, Flame, Hand, Hourglass, Leaf, Sparkles, Wheat, Wind } from "lucide-react";
import { ReactCompareSlider, useReactCompareSliderContext } from "react-compare-slider";
import { Reveal } from "@/components/motion/Reveal";
import { TornEdge } from "@/components/ui/TornEdge";
import { compare, deco } from "@/data/brand-art";
import { cn } from "@/lib/utils/cn";

// Points from the client's own refined-vs-ghani chart (WhatsApp, 2026-11-11), kept to what can be
// said plainly. Disease claims from that chart (cholesterol, heart, diabetes, cancer, weight) are left
// out: FSSAI advertising rules and AGENTS.md ("koi fake claim nahi").
const REFINED = [
  { icon: FlaskConical, text: "Made with chemicals and high heat" },
  { icon: Flame, text: "Most of the seed's natural nutrients are lost" },
  { icon: Wind, text: "Bleached and deodorised, aroma stripped out" },
  { icon: Factory, text: "Made fast, in bulk, by machines" },
];
const GHANI = [
  { icon: Hand, text: "Pressed slowly in a wooden ghani, the natural way" },
  { icon: Sparkles, text: "Natural vitamins and antioxidants stay in" },
  { icon: Wheat, text: "The real taste and aroma of the seed" },
  { icon: Leaf, text: "Nothing added, nothing taken out" },
  { icon: Hourglass, text: "Made with time, patience and care" },
];

/**
 * Refined vs kachi ghani: the same village scene painted twice, with a draggable divider
 * (react-compare-slider). Replaces the old "Still cooking in refined oil?" banner.
 */
export function RefinedVsGhani({ cta }: { cta: { label: string; href: string } }) {
  return (
    <section aria-labelledby="refined-vs-ghani" className="paper-grain relative overflow-hidden bg-ivory pt-8 pb-8 md:pt-14 md:pb-14">
      <TornEdge />
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        {/* Hand-painted vine: closes the product carousel above and opens this story */}
        <Image src={deco.vineDivider.src} alt="" aria-hidden width={deco.vineDivider.width} height={deco.vineDivider.height} sizes="(min-width: 768px) 760px, 90vw" className="mx-auto mb-3 h-auto w-[70%] max-w-[680px] md:mb-7 md:w-[88%]" />
        <Reveal className="mb-5 flex flex-col items-center gap-1.5 text-center md:mb-10 md:gap-2">
          <p lang="hi" className="font-hindi text-base leading-none text-[#b07a10] md:text-xl">
            पहले फ़र्क देखिए
          </p>
          <h2 id="refined-vs-ghani" className="text-[24px] md:text-[44px]">
            Refined vs Kachi Ghani
          </h2>
          <p className="max-w-xl text-sm text-ink-muted md:text-base">Same seed, two very different oils. Drag the line and see.</p>
        </Reveal>

        <div className="relative overflow-hidden rounded-3xl border border-line shadow-[0_24px_60px_-40px_rgba(7,47,27,0.55)]">
          <ReactCompareSlider
            className="aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-[5/2]"
            transition=".7s cubic-bezier(.22,1,.36,1)"
            keyboardIncrement="5%"
            onlyHandleDraggable={false}
            handle={<Handle />}
            itemOne={<Side side="refined" />}
            itemTwo={<Side side="ghani" />}
          />
          {/* Side names, outside the clipped items so they never get cut by the divider */}
          <span className="pointer-events-none absolute z-10 top-3 left-3 rounded-full bg-[#46505c]/85 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-white uppercase backdrop-blur-sm sm:top-5 sm:left-5 sm:text-xs">
            Refined
          </span>
          <span className="pointer-events-none absolute z-10 top-3 right-3 rounded-full bg-forest/90 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[#F3C64A] uppercase backdrop-blur-sm sm:top-5 sm:right-5 sm:text-xs">
            Kachi ghani
          </span>
        </div>

        {/* Phones: the points sit under the painting (on desktop they float on each side). */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
          {[
            { title: "Refined", items: REFINED, warm: false },
            { title: "Kachi ghani", items: GHANI, warm: true },
          ].map(({ title, items, warm }) => (
            <div key={title} className={cn("rounded-2xl border p-3", warm ? "border-forest/15 bg-[#fff6e2]" : "border-line bg-white")}>
              <p className={cn("mb-1.5 text-[11px] font-bold", warm ? "text-forest-text" : "text-[#3f4953]")}>{title}</p>
              <ul className="space-y-1.5">
                {items.slice(0, 3).map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink">
                    <Icon className={cn("mt-px size-3.5 shrink-0", warm ? "text-[#b07a10]" : "text-[#5d6873]")} aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-center md:mt-9">
          <Link
            href={cta.href}
            className="group inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-xs font-bold md:h-12 md:px-7 md:text-sm tracking-wide text-white uppercase transition-colors hover:bg-forest-mid"
          >
            {cta.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** One painting plus its three points on a frosted card, so the card is revealed and hidden with its side. */
function Side({ side }: { side: "refined" | "ghani" }) {
  const img = compare[side];
  return (
    <div className="relative size-full">
      <Image
      src={img.src}
      alt={
        side === "refined"
          ? "An oil refinery: steel tanks, pipes and a chimney, painted in cold greys"
          : "A village kachi ghani turned by a bullock, golden oil pouring into a brass pot"
      }
      fill
      sizes="(min-width: 1360px) 1300px, 100vw"
      className="object-cover object-[50%_68%]"
      />
      {side === "refined" ? (
        <Facts title="Most refined oils" tone="cold" items={REFINED} className="bottom-3 left-3 sm:bottom-6 sm:left-6" />
      ) : (
        <Facts title="Our kachi ghani oils" tone="warm" items={GHANI} className="right-3 bottom-3 sm:right-6 sm:bottom-6" />
      )}
    </div>
  );
}

/** Round grip on a thin white line. Nudges itself once when it first scrolls into view, so people know it moves. */
function Handle() {
  const { setPosition } = useReactCompareSliderContext();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!seen || reduce) return;
    const steps: [number, number][] = [
      [250, 34],
      [1000, 64],
      [1750, 50],
    ];
    const timers = steps.map(([ms, pos]) => setTimeout(() => setPosition(pos), ms));
    return () => timers.forEach(clearTimeout);
  }, [seen, reduce, setPosition]);

  return (
    <div ref={ref} className="relative flex h-full w-full cursor-ew-resize items-center justify-center">
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,0.25)]" />
      <span className="relative grid size-11 place-items-center rounded-full border-[3px] border-white bg-forest text-white shadow-lg sm:size-14">
        <ChevronsLeftRight className="size-5 sm:size-6" aria-hidden />
      </span>
    </div>
  );
}

function Facts({
  title,
  tone,
  items,
  className,
}: {
  title: string;
  tone: "cold" | "warm";
  items: { icon: typeof Flame; text: string }[];
  className: string;
}) {
  const warm = tone === "warm";
  return (
    <div
      className={cn(
        "absolute w-[42%] rounded-xl border p-2 max-sm:hidden shadow-[0_10px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-md sm:w-[330px] sm:rounded-2xl sm:p-4 lg:w-[420px] lg:p-5",
        warm ? "border-white/50 bg-[#fff6e2]/55" : "border-white/60 bg-white/50",
        className,
      )}
    >
      <p className={cn("text-[10px] font-bold tracking-[0.12em] uppercase max-sm:hidden sm:text-xs sm:tracking-[0.14em]", warm ? "text-forest-text" : "text-[#3f4953]")}>
        {title}
      </p>
      <ul className="space-y-1 sm:mt-2.5 sm:space-y-2">
        {/* Phones: the side labels already name each card, so only the first three points show. */}
        {items.map(({ icon: Icon, text }, i) => (
          <li key={text} className={cn("flex items-start gap-1.5 text-[11px] leading-snug font-medium sm:gap-2.5 sm:text-[15px]", i >= 3 && "max-sm:hidden")}>
            <Icon className={cn("mt-px size-3.5 shrink-0 sm:mt-0.5 sm:size-[18px]", warm ? "text-[#b07a10]" : "text-[#5d6873]")} aria-hidden />
            <span className={warm ? "text-ink" : "text-[#2f3740]"}>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
