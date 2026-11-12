"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SectionHeader, sectionClass } from "@/components/ui/SectionHeader";
import type { StoryStep } from "@/data/pdp-story";
import { cn } from "@/lib/utils/cn";

/**
 * "The kachi ghani way": a timeline that fills as you scroll, lighting each numbered stop, with
 * the five step cards rising in one after another. Hover lifts a card and eases its painting in.
 * Phones: a vertical timeline (line fills down as you scroll, rows slide in, the reached step
 * lights up). Reduced motion: everything shown, nothing moves.
 */
export function MethodSteps({ eyebrow, title, intro, steps }: { eyebrow: string; title: string; intro: string; steps: StoryStep[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  const [lit, setLit] = useState(0);
  // A stop lights up once the line has actually reached it.
  useMotionValueEvent(fill, "change", (v) => setLit(v < 0.02 ? 0 : Math.floor(v * (steps.length - 1) + 0.02) + 1));
  const shown = reduce ? steps.length : lit;

  // Phone timeline: its own scroll progress (the list is tall, so it fills as you read down).
  const mRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress: mProgress } = useScroll({ target: mRef, offset: ["start 75%", "end 60%"] });
  const mFill = useSpring(mProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  const [mLit, setMLit] = useState(0);
  useMotionValueEvent(mFill, "change", (v) => setMLit(v < 0.02 ? 0 : Math.floor(v * (steps.length - 1) + 0.05) + 1));
  const mShown = reduce ? steps.length : mLit;

  return (
    <section className={sectionClass} aria-labelledby="method-h">
      <SectionHeader id="method-h" eyebrow={eyebrow} title={title} subtitle={intro} />

      {/* Phones: vertical timeline */}
      <ol ref={mRef} className="relative space-y-3 md:hidden">
        <span aria-hidden className="absolute top-6 bottom-6 left-[17px] w-[3px] rounded-full bg-line" />
        <motion.span
          aria-hidden
          className="absolute top-6 bottom-6 left-[17px] w-[3px] origin-top rounded-full bg-gradient-to-b from-co-accent to-forest"
          style={{ scaleY: reduce ? 1 : mFill }}
        />
        {steps.map((s, i) => {
          const on = i < mShown;
          return (
            <motion.li
              key={s.title}
              className="relative flex items-center gap-3 pl-12"
              initial={reduce ? false : { opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-0 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border-2 text-xs font-bold tabular-nums transition-all duration-500",
                  on ? "scale-110 border-forest bg-forest text-white shadow-[0_0_0_5px_rgba(14,59,38,0.12)]" : "border-line bg-surface text-ink-muted",
                )}
              >
                {i + 1}
              </span>
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-2 pr-3 transition-colors duration-500",
                  on ? "border-forest/20 bg-surface shadow-[0_10px_24px_-18px_rgba(7,47,27,0.4)]" : "border-line/70 bg-surface/60",
                )}
              >
                <span className="relative size-[72px] shrink-0 overflow-hidden rounded-xl bg-sunken">
                  {s.image && <Image src={s.image} alt="" fill sizes="72px" className={cn("object-cover transition-transform duration-700", on && "scale-[1.06]")} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] leading-tight font-semibold text-ink">{s.title}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-ink-muted">{s.body}</span>
                </span>
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div ref={ref} className="hidden md:block">
        {/* Track (md+): line from the first stop to the last, filling with scroll. */}
        <div aria-hidden className="relative mb-6 hidden md:grid md:grid-cols-5">
          <span className="absolute top-1/2 right-[10%] left-[10%] h-[3px] -translate-y-1/2 rounded-full bg-line" />
          <motion.span
            className="absolute top-1/2 left-[10%] h-[3px] w-[80%] origin-left -translate-y-1/2 rounded-full bg-gradient-to-r from-co-accent to-forest"
            style={{ scaleX: reduce ? 1 : fill }}
          />
          {steps.map((s, i) => {
            const on = i < shown;
            return (
              <span key={s.title} className="relative grid place-items-center">
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-full border-2 text-sm font-bold tabular-nums transition-all duration-500",
                    on ? "scale-110 border-forest bg-forest text-white shadow-[0_0_0_6px_rgba(14,59,38,0.12)]" : "border-line bg-surface text-ink-muted",
                  )}
                >
                  {i + 1}
                </span>
              </span>
            );
          })}
        </div>

        <ol className="grid grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <motion.li
              key={s.title}
              className="group"
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className={cn(
                  "relative aspect-square overflow-hidden rounded-3xl border bg-sunken transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_18px_40px_-24px_rgba(7,47,27,0.45)]",
                  i < shown ? "border-forest/25" : "border-line",
                )}
              >
                {s.image && (
                  <Image src={s.image} alt="" fill sizes="240px" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" />
                )}
              </div>
              <p className="mt-3 font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
