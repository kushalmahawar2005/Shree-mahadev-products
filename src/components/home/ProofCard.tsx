"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;

/** Media shown at the top of a proof card. Documents stack like paper; video gets a play button. */
export type ProofMedia =
  | { kind: "doc"; src: string; back?: string; alt: string }
  | { kind: "video"; poster: string; alt: string };

/**
 * One "backed by proof" card. Identical structure on every card so titles, facts and CTAs line up:
 * fixed 4:3 media (the real document is the hero) → small seal overlapping its corner → title →
 * one "data" fact line → a two-line description → ghost CTA pinned to the bottom (mt-auto).
 * Clicking the media opens the full document/video (handled by the parent via `onOpenMedia`).
 */
export function ProofCard({
  media,
  seal,
  title,
  fact,
  text,
  cta,
  onOpenMedia,
}: {
  media: ProofMedia;
  seal: string;
  title: string;
  fact: string;
  text: string;
  cta: { label: string; href?: string; onClick?: () => void };
  onOpenMedia: () => void;
}) {
  const reduce = useReducedMotion();
  // Document straightens and lifts when the card is hovered (variants flow down from the card).
  const doc: Variants = reduce
    ? { rest: { rotate: 0, y: 0 }, hover: { rotate: 0, y: 0 } }
    : { rest: { rotate: -3, y: 0 }, hover: { rotate: 0, y: -6 } };
  const back: Variants = reduce ? { rest: { rotate: 3 }, hover: { rotate: 3 } } : { rest: { rotate: 3, y: 0 }, hover: { rotate: 5, y: -2 } };

  const ctaClass =
    "inline-flex h-11 items-center gap-2 self-start rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest-text transition-colors duration-300 hover:border-forest hover:bg-forest hover:text-white";

  return (
    <motion.article
      initial="rest"
      animate="rest"
      whileHover="hover"
      className="group flex h-full flex-col rounded-3xl border border-white/70 bg-white p-3 shadow-[0_18px_40px_-28px_rgba(120,80,10,0.45)] transition-shadow duration-500 hover:shadow-[0_34px_60px_-30px_rgba(120,80,10,0.6)] md:p-4"
    >
      {/* Media: fixed 4:3 so every card's text starts on the same line */}
      <button
        type="button"
        onClick={onOpenMedia}
        aria-label={`Open: ${media.alt}`}
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f6efe2] outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
      >
        {media.kind === "doc" ? (
          <>
            {/* second page peeking behind */}
            <motion.span
              variants={back}
              transition={SPRING}
              aria-hidden
              className="absolute top-[9%] left-[16%] block w-[72%] origin-bottom overflow-hidden rounded-md bg-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]"
            >
              {media.back ? (
                <Image src={media.back} alt="" width={720} height={1018} sizes="320px" className="h-auto w-full opacity-90" />
              ) : (
                <span className="block aspect-[1/1.41] w-full bg-white" />
              )}
            </motion.span>
            {/* the document itself: top-anchored so its letterhead is readable in the card */}
            <motion.span
              variants={doc}
              transition={SPRING}
              className="absolute top-[7%] left-[12%] block w-[76%] origin-bottom overflow-hidden rounded-md bg-white ring-1 ring-black/5 shadow-[0_18px_34px_-16px_rgba(0,0,0,0.45)] transition-shadow duration-500 group-hover:shadow-[0_28px_44px_-18px_rgba(0,0,0,0.5)]"
            >
              <Image src={media.src} alt={media.alt} width={1100} height={1555} sizes="(min-width: 1024px) 340px, 80vw" className="h-auto w-full" />
            </motion.span>
            {/* soft fade where the page leaves the frame */}
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#f6efe2] to-transparent" />
          </>
        ) : (
          <>
            <Image
              src={media.poster}
              alt={media.alt}
              fill
              sizes="(min-width: 1024px) 380px, 90vw"
              className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] motion-reduce:transform-none"
            />
            <span aria-hidden className="absolute inset-0 bg-black/10" />
            <span className="absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-forest shadow-lg backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
              <Play className="ml-0.5 size-5 fill-forest" />
            </span>
          </>
        )}
      </button>

      {/* Seal, small, overlapping the media's bottom-left corner */}
      <Image
        src={seal}
        alt=""
        width={112}
        height={112}
        sizes="56px"
        className="relative z-10 -mt-7 ml-4 size-14 rounded-full bg-white object-contain shadow-md ring-4 ring-white"
      />

      <div className="flex flex-1 flex-col px-1 pt-3 pb-1 md:px-2">
        <h3 className="text-xl font-semibold text-forest-text">{title}</h3>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink-muted tabular-nums">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
          <span>{fact}</span>
        </p>
        <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-pretty text-[#4b3a22]">{text}</p>

        <div className="mt-auto pt-5">
          {cta.href ? (
            <Link href={cta.href} className={ctaClass}>
              {cta.label} <ArrowRight className="size-4" />
            </Link>
          ) : (
            <button type="button" onClick={cta.onClick} className={ctaClass}>
              {cta.label} <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
