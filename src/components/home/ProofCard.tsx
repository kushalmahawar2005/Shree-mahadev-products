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

  // Phones show a one-word action under the small card.
  const short = media.kind === "doc" ? "View" : "Watch";
  const ctaClass =
    "inline-flex items-center gap-0.5 self-start text-[11px] font-semibold text-forest max-md:underline-offset-2 max-md:hover:underline md:h-11 md:gap-2 md:rounded-full md:border md:border-forest/20 md:px-4 md:text-sm md:text-forest-text transition-colors duration-300 md:hover:border-forest md:hover:bg-forest md:hover:text-white";

  return (
    <motion.article
      initial="rest"
      animate="rest"
      whileHover="hover"
      className="group flex h-full flex-col gap-2 rounded-2xl border border-white/70 bg-white p-1.5 shadow md:gap-0 md:rounded-3xl md:p-4-[0_18px_40px_-28px_rgba(120,80,10,0.45)] transition-shadow duration-500 hover:shadow-[0_34px_60px_-30px_rgba(120,80,10,0.6)] md:p-4"
    >
      {/* Media: fixed 4:3 so every card's text starts on the same line */}
      <button
        type="button"
        onClick={onOpenMedia}
        aria-label={`Open: ${media.alt}`}
        className="relative block aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-[#f6efe2] md:aspect-[4/3] md:rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
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
        className="relative z-10 -mt-7 ml-4 hidden size-14 rounded-full md:block bg-white object-contain shadow-md ring-4 ring-white"
      />

      <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 md:px-2 md:pt-3">
        <h3 className="line-clamp-2 text-[12.5px] leading-tight font-semibold text-forest-text md:line-clamp-none md:text-xl">{title}</h3>
        <p className="mt-1.5 hidden items-start gap-1.5 text-sm text-ink-muted tabular-nums md:flex">
          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-forest md:mt-0.5 md:size-4" aria-hidden />
          <span className="line-clamp-1 md:line-clamp-none">{fact}</span>
        </p>
        <p className="mt-3 line-clamp-2 hidden text-[15px] leading-relaxed text-pretty text-[#4b3a22] md:block">{text}</p>

        <div className="mt-auto pt-1.5 md:pt-5">
          {cta.href ? (
            <Link href={cta.href} className={ctaClass}>
              <span className="md:hidden">{short}</span>
              <span className="max-md:hidden">{cta.label}</span> <ArrowRight className="size-3 md:size-4" />
            </Link>
          ) : (
            <button type="button" onClick={cta.onClick} className={ctaClass}>
              <span className="md:hidden">{short}</span>
              <span className="max-md:hidden">{cta.label}</span> <ArrowRight className="size-3 md:size-4" />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
