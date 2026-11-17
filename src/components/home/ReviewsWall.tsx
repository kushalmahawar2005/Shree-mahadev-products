"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, Quote, Star } from "lucide-react";
import { BadgeCheck } from "@/components/icons/duo";
import { Marquee } from "@/components/shadcn/marquee";
import type { PublicReview } from "@/lib/server/reviews";
import { cn } from "@/lib/utils/cn";
import { showRating } from "@/lib/utils/reviews";

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const TINTS = ["#0c3c24", "#8a5a0b", "#5b3a1e", "#2a6b44", "#b49024"];

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)} aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-4", i < n ? "fill-[#f5b400] text-[#f5b400]" : "fill-line text-line")} />
      ))}
    </span>
  );
}

function ReviewCard({ r, i }: { r: PublicReview; i: number }) {
  return (
    <article className="relative flex w-[270px] flex-col rounded-3xl border border-line bg-white p-4 sm:w-[300px] sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:w-[340px]">
      <Quote aria-hidden className="absolute top-4 right-4 size-8 fill-khaki-soft text-khaki-soft" />
      <Stars n={r.rating} />
      {r.title && <h3 className="mt-2.5 text-base leading-snug sm:mt-3 sm:text-lg">{r.title}</h3>}
      <p className="mt-1.5 line-clamp-4 text-[13px] leading-relaxed text-ink sm:text-sm">{r.body}</p>
      <div className="mt-auto flex items-center gap-3 pt-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: TINTS[i % TINTS.length] }}>
          {initials(r.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-semibold text-ink">
            <span className="truncate">{r.name}</span>
            {r.verified && <BadgeCheck className="size-4 shrink-0 text-forest" aria-label="Verified buyer" />}
          </span>
          <span className="block truncate text-xs text-ink-muted">{r.city ? `${r.city} · ` : ""}{r.verified ? "Verified buyer" : "Customer"}</span>
        </span>
      </div>
      <Link
        href={`/products/${r.productHandle}#reviews-heading`}
        className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-khaki-soft px-3 py-1 text-xs font-semibold text-forest-text transition-colors hover:bg-forest hover:text-white"
      >
        {shortTitle(r.productTitle)} <ArrowRight className="size-3" />
      </Link>
    </article>
  );
}

/** Reviews: rating summary panel + two Magic UI marquee rows moving in opposite directions (pause on hover). */
export function ReviewsWall({ reviews }: { reviews: PublicReview[] }) {
  const reduce = useReducedMotion();
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const verified = reviews.filter((r) => r.verified).length;
  // Too few reviews for a fair average: lead with "real reviews" instead of a 5.0 score.
  const scored = showRating(reviews.length);
  const half = Math.ceil(reviews.length / 2);
  const rowA = reviews.slice(0, half);
  const rowB = reviews.length > 3 ? reviews.slice(half) : [];

  return (
    <section className="paper-grain relative overflow-hidden bg-page pt-10 pb-12 md:py-20">
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <div className="mb-5 flex flex-col items-center gap-2 text-center md:mb-10">
          <p lang="hi" className="font-hindi inline-flex items-center gap-2 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-sm text-sale md:text-base">
            <Star className="size-3.5 fill-current" /> भारतीय रसोई की पसंद
          </p>
          <h2 className="text-[24px] md:text-[44px]">What customers say</h2>
        </div>

        <div className="grid items-center gap-4 sm:gap-6 lg:grid-cols-[300px_1fr]">
          {/* Summary. Phone: one slim row (score · stars + count · arrow). sm+: the full panel. */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-forest px-4 py-3 text-white sm:block sm:rounded-3xl sm:p-6"
          >
            {scored ? (
              <>
                <p className="relative text-4xl leading-none font-extrabold tabular-nums sm:text-6xl sm:leading-tight">{avg.toFixed(1)}</p>
                <div className="relative min-w-0 flex-1">
                  <Stars n={Math.round(avg)} className="sm:mt-2" />
                  <p className="mt-1.5 text-[13px] text-white/75 sm:mt-2 sm:text-sm">
                    From {reviews.length} reviews
                    {verified ? ` · ${verified} verified` : ""}
                  </p>
                </div>
              </>
            ) : (
              <div className="relative min-w-0 flex-1">
                <p className="text-xl leading-tight font-extrabold sm:text-3xl">Real words from real kitchens</p>
                <p className="mt-1.5 text-[13px] text-white/75 sm:mt-2 sm:text-sm">Reviews from people who ordered from us.</p>
              </div>
            )}
            <Link
              href="/shop"
              aria-label="Explore the store"
              className="relative grid size-10 shrink-0 place-items-center rounded-full bg-co-gold text-forest-deep transition-colors hover:bg-white sm:hidden"
            >
              <ArrowRight className="size-[18px]" />
            </Link>
            <p className="relative mt-5 hidden text-sm leading-relaxed text-white/85 sm:block">Every review here is from someone who bought from us. We don&apos;t edit them.</p>
            <Link
              href="/shop"
              className="btn-shine relative mt-6 hidden h-11 items-center gap-2 overflow-hidden rounded-full bg-co-gold px-5 text-sm font-bold text-forest-deep transition-colors hover:bg-white sm:inline-flex"
            >
              Explore the store <ArrowRight className="size-4" />
            </Link>
          </motion.div>

          {/* Wall */}
          <div className={cn("relative min-w-0", !(reduce || reviews.length < 3) && "[mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]")}>
            {reduce || reviews.length < 3 ? (
              // Few reviews: a still list; on phones each card takes the full width.
              <div className="flex flex-wrap gap-4 max-sm:[&>article]:w-full">
                {reviews.map((r, i) => (
                  <ReviewCard key={r.id} r={r} i={i} />
                ))}
              </div>
            ) : (
              <>
              {/* Phone: a single calm row with every review. */}
              <Marquee pauseOnHover className="p-0 [--duration:60s] [--gap:0.75rem] md:hidden">
                {reviews.map((r, i) => (
                  <ReviewCard key={r.id} r={r} i={i} />
                ))}
              </Marquee>
              <div className="space-y-4 max-md:hidden">
                <Marquee pauseOnHover className="p-0 [--duration:45s] [--gap:1rem]">
                  {rowA.map((r, i) => (
                    <ReviewCard key={r.id} r={r} i={i} />
                  ))}
                </Marquee>
                {rowB.length > 0 && (
                  <Marquee pauseOnHover reverse className="p-0 [--duration:50s] [--gap:1rem]">
                    {rowB.map((r, i) => (
                      <ReviewCard key={r.id} r={r} i={i + half} />
                    ))}
                  </Marquee>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
