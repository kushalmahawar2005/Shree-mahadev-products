"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowRight, ChevronsLeftRight, Factory, FlaskConical, Flame, Hand, Hourglass, Leaf, Sparkles, Wheat, Wind } from "lucide-react";
import { ReactCompareSlider } from "react-compare-slider";
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
  { icon: Hand, text: "Kolhu wood pressed, the natural way" },
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
  // Which label the divider is over (only re-renders when it crosses a label, so dragging stays smooth).
  const [zone, setZone] = useState<"left" | "mid" | "right">("mid"); // starts at 60%: wood-pressed side shows more
  const onPos = useCallback((p: number) => setZone(p < 22 ? "left" : p > 78 ? "right" : "mid"), []);
  return (
    <section aria-labelledby="refined-vs-ghani" className="paper-grain relative overflow-hidden bg-ivory pt-6 pb-12 md:pt-11 md:pb-14">
      <TornEdge />
      <div className="relative mx-auto max-w-[1360px] px-6 md:px-8">
        {/* Hand-painted vine: closes the product carousel above and opens this story */}
        <Image src={deco.vineDivider.src} alt="" aria-hidden width={deco.vineDivider.width} height={deco.vineDivider.height} sizes="(min-width: 768px) 760px, 90vw" className="mx-auto mb-4 h-auto w-[70%] max-w-[680px] md:mb-7 md:w-[88%]" />

        {/* Header, two rows. Row 1: centered heading, kept on one line.
            Row 2: subtitle left, Dadi right, bottom-aligned; she sits behind the card (lower z-index,
            small negative margin), so the card's top edge crops her and its corner/label stay clear. */}
        {/* md+: centred heading on one line, Dadi on the right leaning on the card's top edge.
            Phones: heading on two lines, subtitle left, Dadi right, her arms resting on the card. */}
        <div className="relative sm:pb-10">
        <Reveal className="flex w-full flex-col items-center gap-0.5 text-center md:-translate-y-3 md:gap-2">
          {/* "vs" sits on the centre line: each side takes an equal column. */}
          <h2 id="refined-vs-ghani" className="grid w-full grid-cols-[1fr_auto_1fr] items-baseline gap-x-[0.3em] whitespace-nowrap text-[clamp(12px,5.3vw,28px)] leading-[1.1] sm:text-[clamp(16px,2.5vw,26px)] md:text-[clamp(24px,3vw,42px)] min-[1400px]:text-[44px]">
            <span className="text-right">Wood-Pressed</span>
            <span>vs</span>
            <span className="text-left">Refined Oil</span>
          </h2>
          {/* Under the heading (same shift as the heading, centred under "vs"). */}
          <p className="w-full text-center text-xs text-ink-muted md:text-base">Same seed, two very different oils.</p>
          <p lang="hi" className="font-hindi hidden text-xl leading-snug text-[#b07a10] sm:block">
            पहले फ़र्क देखिए
          </p>
        </Reveal>
        <div className="mt-3 flex items-end justify-between gap-1 sm:mt-0 sm:block">
          {/* Hindi line in front of Dadi's open hand, as if she is saying it. */}
          <p lang="hi" className="font-hindi mb-14 flex-1 self-end text-right text-lg leading-snug text-[#b07a10] sm:hidden">
            पहले फ़र्क देखिए
          </p>
          <Image
            src="/images/dadi-leaning.webp"
            alt="Dadi leaning on the comparison, smiling and pointing to it"
            width={960}
            height={598}
            sizes="(min-width: 1024px) 400px, (min-width: 768px) 320px, 180px"
            className="pointer-events-none relative z-0 -mb-1 h-[clamp(100px,30vw,128px)] w-auto shrink-0 sm:absolute sm:-right-4 sm:-bottom-1 sm:m-0 sm:h-[clamp(120px,16vw,230px)] md:-right-8 lg:-right-6 min-[1400px]:h-[250px] xl:-right-8"
          />
        </div>
        </div>

        <div className="relative z-10 overflow-hidden rounded-3xl border border-line shadow-[0_24px_60px_-40px_rgba(7,47,27,0.55)]">
          <ReactCompareSlider
            defaultPosition={50}
            onPositionChange={onPos}
            style={{ touchAction: "pan-y" }}
            className="aspect-[3/4] w-full select-none sm:aspect-[16/10] lg:aspect-[5/2]"
            transition=".7s cubic-bezier(.22,1,.36,1)"
            keyboardIncrement="5%"
            onlyHandleDraggable={false}
            handle={<Handle />}
            itemOne={<Side side="ghani" />}
            itemTwo={<Side side="refined" />}
          />
          {/* Side names, outside the clipped items so they never get cut by the divider */}
          <span className={cn("pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-forest/90 px-3 py-1 text-[10px] leading-4 font-bold tracking-[0.16em] text-[#F3C64A] uppercase backdrop-blur-sm transition-opacity duration-200 sm:text-xs", zone === "left" && "opacity-0")}>
            Wood-pressed
          </span>
          <span className={cn("pointer-events-none absolute top-3 right-3 z-10 rounded-full bg-[#46505c]/85 px-3 py-1 text-[10px] leading-4 font-bold tracking-[0.16em] text-white uppercase backdrop-blur-sm transition-opacity duration-200 sm:text-xs", zone === "right" && "opacity-0")}>
            Refined
          </span>
        </div>

        {/* Phones: the points sit under the painting (on desktop they float on each side). */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
          {[
            { title: "Wood-pressed", items: GHANI, warm: true },
            { title: "Refined", items: REFINED, warm: false },
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
  const mobile = side === "refined" ? compare.refinedMobile : compare.ghaniMobile;
  return (
    <div className="relative size-full">
      {/* Phones: portrait version of the same scene. */}
      <Image
        src={mobile.src}
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="object-cover object-top sm:hidden"
      />
      <Image
      src={img.src}
      alt={
        side === "refined"
          ? "An oil refinery: steel tanks, pipes and a chimney, painted in cold greys"
          : "Our process under the Mahadev logo: seeds poured in, cleaned by hand, pressed in the kolhu, settled for 10 days and bottled"
      }
      fill
      sizes="(min-width: 1360px) 1300px, 100vw"
      className={cn("object-cover max-sm:hidden", side === "refined" ? "object-[50%_50%]" : "object-[50%_55%]", side === "refined" ? "[filter:saturate(.7)_hue-rotate(-6deg)_brightness(1.02)]" : "[filter:saturate(1.12)_sepia(.08)]")}
      />
      {side === "refined" ? (
        <Facts title="Most refined oils" tone="cold" items={REFINED} className="right-3 bottom-3 sm:right-6 sm:bottom-6" />
      ) : (
        <Facts title="Our wood-pressed oils" tone="warm" items={GHANI} className="top-12 left-3 sm:top-14 sm:left-6" />
      )}
    </div>
  );
}

/** Round grip on a thin white line centered beneath the heading's "vs". */
function Handle() {
  return (
    <div className="relative flex h-full w-full cursor-ew-resize items-center justify-center">
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,0.25)]" />
      <span className="relative grid size-12 place-items-center rounded-full border-[3px] border-white bg-forest text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:size-14">
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
        "absolute w-[42%] rounded-xl border p-2 max-sm:hidden shadow-[0_10px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-md sm:w-[min(280px,calc(50vw-2.5rem))] sm:rounded-2xl sm:p-[clamp(9px,1.2vw,13px)] lg:w-[330px] lg:p-4",
        warm ? "border-white/50 bg-[#fff6e2]/55" : "border-white/60 bg-white/50",
        className,
      )}
    >
      <p className={cn("text-[10px] font-bold tracking-[0.12em] uppercase max-sm:hidden sm:text-[11px] sm:tracking-[0.14em]", warm ? "text-forest-text" : "text-[#3f4953]")}>
        {title}
      </p>
      <ul className="space-y-1 sm:mt-2 sm:space-y-[clamp(3px,0.6vw,6px)]">
        {/* Phones: the side labels already name each card, so only the first three points show. */}
        {items.map(({ icon: Icon, text }, i) => (
          <li key={text} className={cn("flex items-start gap-1.5 text-[11px] leading-snug font-medium sm:gap-[clamp(6px,0.8vw,8px)] sm:text-[clamp(11.5px,1.3vw,13px)] lg:text-[13px]", i >= 3 && "max-sm:hidden")}>
            <Icon className={cn("mt-px size-3.5 shrink-0 sm:mt-0.5 sm:size-[clamp(13px,1.4vw,15px)] lg:size-[15px]", warm ? "text-[#b07a10]" : "text-[#5d6873]")} aria-hidden />
            <span className={warm ? "text-ink" : "text-[#2f3740]"}>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
