"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { TornEdge } from "@/components/ui/TornEdge";
import { cn } from "@/lib/utils/cn";

/** Caption under the illustration. Change the name here. */
export const DADI_CAPTION = "Dadi ji, the heart of Mahadev Products";
const DADI_QUOTE = "जैसा हमारे ज़माने में बनता था, वैसा ही शुद्ध।";

type Step = { title: string; titleHi: string; text: string; img: string };
/** The client's real six-step process (from their catalog). Illustrations in /public/illustrations/process/. */
const STEPS: Step[] = [
  { title: "Farm sourced", titleHi: "खेत से बीज", text: "Seeds sourced directly from farmers", img: "1-farm" },
  { title: "Hand cleaned", titleHi: "हाथ से सफ़ाई", text: "Every batch cleaned and sorted by hand", img: "2-hand-cleaned" },
  { title: "Wood pressed", titleHi: "लकड़ी की घाणी", text: "Kolhu wood pressed in our kachi ghani, without high heat", img: "3-wood-pressed" },
  { title: "Cotton cloth filtered", titleHi: "सूती कपड़े से छनाई", text: "Filtered through pure cotton cloth", img: "4-cloth-filtered" },
  { title: "Gravity sedimentation", titleHi: "10 दिन निथार", text: "Rested 10 days so fine particles settle on their own", img: "4b-gravity-settled" },
  { title: "Bottled", titleHi: "बोतल में भराई", text: "Food-grade PET bottles, every batch lab tested", img: "5-bottled" },
];
const HERO = 2; // "Wood pressed", the heart of the process

/** True for every oil we sell (no mustard-only claims). */
const CHIPS: { label: string; href?: string }[] = [
  { label: "No chemicals" },
  { label: "No high heat" },
  { label: "Natural aroma" },
  { label: "Lab tested", href: "#proof" },
];

const EASE = [0.22, 1, 0.36, 1] as const;
/** Dashed line as a background (6px dash, 8px gap) so it never stretches while it "draws". */
const DASHES = "repeating-linear-gradient(to bottom, color-mix(in srgb, var(--color-forest) 40%, transparent) 0 6px, transparent 6px 14px)";

/**
 * "Why choose our oil?": one section. Dadi ji beside our motor-driven wooden ghani on the left
 * (sticky on desktop), and on the right the five real steps from farm to bottle as a vertical
 * timeline whose dashed line draws as you scroll; each step slides in as the line reaches it and
 * its badge turns mustard. Step 3 (wood pressed) is the highlighted heart of the process.
 */
export function WhyChooseOil() {
  const reduce = useReducedMotion();
  const timeline = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: timeline, offset: ["start 65%", "end 55%"] });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const [active, setActive] = useState(reduce ? STEPS.length - 1 : -1);

  return (
    <section id="ghani-process" aria-labelledby="why-oil-title" className="paper-grain relative scroll-mt-24 bg-ivory py-10 md:py-20">
      <TornEdge />
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <p className="font-hindi flex items-center gap-2 text-base text-sale md:text-lg" lang="hi">
            <span aria-hidden className="h-px w-6 bg-sale/50" />
            हमारा तेल ही क्यों
            <span aria-hidden className="h-px w-6 bg-sale/50" />
          </p>
          <h2 id="why-oil-title" className="mt-1.5 text-[24px] leading-[1.1] md:mt-2 font-bold tracking-tight md:text-[44px]">
            Why choose our oil?
          </h2>
          <p className="mt-2 max-w-xl text-sm text-ink-muted md:mt-3 md:text-base">
            Slow-speed wooden ghani, strained through cloth and clarified by natural settling. No chemicals, no high heat.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:mt-14 md:gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
          {/* LEFT: Dadi ji (sticky while the steps scroll past) */}
          <div className="relative mx-auto w-full max-w-[300px] md:max-w-[440px] lg:sticky lg:top-[152px] lg:col-span-5 lg:max-w-none">
            {/* soft mustard sun */}
            <span
              aria-hidden
              className="absolute top-[4%] left-1/2 aspect-square w-[88%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_closest-side,rgba(236,196,98,0.30)_0%,rgba(236,196,98,0.16)_60%,transparent_100%)]"
            />
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: EASE }}
              className="relative"
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, -4, 0] }}
                transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: [0.37, 0, 0.63, 1] }}
              >
                <Image
                  src="/illustrations/dadi-bottle.webp"
                  alt="Dadi ji in a pink bandhani saree holding a bottle of Mahadev wood-pressed groundnut oil"
                  width={556}
                  height={1285}
                  unoptimized
                  className="relative mx-auto h-auto max-h-[280px] w-auto drop-shadow-[0_16px_20px_rgba(60,40,10,0.12)] md:max-h-[400px] lg:max-h-[520px]"
                />
              </motion.div>
              {/* Speech bubble, tail pointing down-left to Dadi */}
              <motion.p
                lang="hi"
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: reduce ? 0 : 0.3, ease: EASE }}
                className="font-hindi absolute top-[6%] left-[56%] max-w-[11rem] origin-bottom-left rounded-2xl border border-line bg-page px-3 py-2 text-[12.5px] leading-snug md:max-w-[13.5rem] md:px-3.5 md:py-2.5 md:text-[15px] text-forest-text shadow-[0_10px_24px_-14px_rgba(7,47,27,0.45)] sm:left-[55%] md:text-base"
              >
                {DADI_QUOTE}
                <span aria-hidden className="absolute -bottom-[7px] left-5 size-3.5 rotate-45 border-r border-b border-line bg-page" />
              </motion.p>
            </motion.div>
            <p className="relative mt-3 text-center text-xs text-ink-muted">{DADI_CAPTION}</p>
          </div>

          {/* RIGHT: six-step timeline, then chips + CTA */}
          <div className="lg:col-span-7">
            <ol ref={timeline} className="relative space-y-3 overflow-x-clip md:space-y-8">
              {/* dashed line: faint full track + the part drawn so far */}
              <span aria-hidden className="absolute top-2 bottom-2 left-[13px] w-0.5 opacity-30 md:left-[17px]" style={{ backgroundImage: DASHES }} />
              <motion.span
                aria-hidden
                className="absolute top-2 left-[13px] w-0.5 md:left-[17px]"
                style={{ backgroundImage: DASHES, height: reduce ? "calc(100% - 1rem)" : lineHeight, maxHeight: "calc(100% - 1rem)" }}
              />
              {STEPS.map((s, i) => {
                const hero = i === HERO;
                const on = i <= active;
                return (
                  <motion.li
                    key={s.title}
                    initial={reduce ? false : { opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "0px 0px -35% 0px" }}
                    onViewportEnter={() => setActive((a) => Math.max(a, i))}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="relative flex items-center gap-3 pl-10 md:gap-6 md:pl-14"
                  >
                    <span
                      className={cn(
                        "absolute top-1/2 left-0 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-xs font-bold ring-4 md:size-9 md:text-sm ring-ivory transition-colors duration-500",
                        on ? "bg-mustard text-forest-deep" : "bg-forest text-khaki-soft",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className={cn("flex min-w-0 flex-1 items-center gap-3 md:gap-6", hero && "rounded-2xl bg-[#E3B341]/10 p-2.5 md:rounded-3xl md:p-5")}>
                      <div className={cn("relative shrink-0", hero ? "size-20 md:size-[180px]" : "size-16 md:size-[140px]")}>
                        <Image
                          src={`/illustrations/process/${s.img}.webp`}
                          alt=""
                          fill
                          sizes={hero ? "(min-width: 768px) 180px, 120px" : "(min-width: 768px) 140px, 96px"}
                          className="object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        {hero && (
                          <p className="mb-1 inline-flex rounded-full bg-mustard/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap text-forest-text md:px-2.5 md:text-[11px]">The heart of our process</p>
                        )}
                        <h3 className={cn("leading-tight font-semibold text-forest-text", hero ? "text-[17px] md:text-xl" : "text-[15px] md:text-lg")}>{s.title}</h3>
                        <p className="font-hindi text-[12.5px] text-sale md:text-sm" lang="hi">
                          {s.titleHi}
                        </p>
                        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted md:mt-1 md:text-sm">{s.text}</p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>

            <ul className="mt-6 grid grid-cols-2 gap-2 md:mt-10 md:flex md:flex-wrap md:justify-center lg:justify-start lg:pl-14">
              {CHIPS.map((c) => {
                const cls = "inline-flex h-11 w-full items-center gap-2 rounded-full border border-forest/15 bg-white pr-3 pl-1.5 text-[13px] font-semibold whitespace-nowrap text-forest-text shadow-[0_6px_16px_-12px_rgba(7,47,27,0.45)] md:w-auto md:pr-4 md:text-sm";
                const inner = (
                  <>
                    {/* Filled green tick badge, so the promise reads as "checked", not as a bullet. */}
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-forest text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]">
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                    {c.label}
                  </>
                );
                return (
                  <li key={c.label}>
                    {c.href ? (
                      <a href={c.href} className={cn(cls, "transition-colors hover:border-forest/40 hover:bg-white")}>
                        {inner}
                      </a>
                    ) : (
                      <span className={cls}>{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex justify-center md:mt-7 lg:justify-start lg:pl-14">
              <Link
                href="/collections/wood-pressed-oils"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-forest/25 bg-forest px-5 text-[13px] font-semibold text-white md:h-11 md:bg-transparent md:px-5 md:text-sm md:text-forest-text transition-colors duration-300 hover:border-forest hover:bg-forest hover:text-white"
              >
                Shop wood-pressed oils <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
      <TornEdge flip color="var(--color-page)" />
    </section>
  );
}
