"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, Quote, Star } from "lucide-react";
import { Marquee } from "@/components/shadcn/marquee";
import type { PublicReview } from "@/lib/server/reviews";
import { cn } from "@/lib/utils/cn";

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
    <article className="relative flex w-[300px] flex-col rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:w-[340px]">
      <Quote aria-hidden className="absolute top-4 right-4 size-8 fill-khaki-soft text-khaki-soft" />
      <Stars n={r.rating} />
      {r.title && <h3 className="mt-3 text-lg leading-snug">{r.title}</h3>}
      <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-ink">{r.body}</p>
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
  const half = Math.ceil(reviews.length / 2);
  const rowA = reviews.slice(0, half);
  const rowB = reviews.length > 3 ? reviews.slice(half) : [];

  return (
    <section className="paper-grain relative overflow-hidden bg-[#F5EDDE] py-14 md:py-20">
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <div className="mb-8 flex flex-col items-center gap-2 text-center md:mb-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">
            <Star className="size-3.5 fill-current" /> Loved in Indian kitchens
          </p>
          <h2 className="text-3xl md:text-[44px]">What customers say</h2>
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-[300px_1fr]">
          {/* Summary */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl bg-forest p-6 text-white"
          >
            <p className="relative text-6xl font-extrabold tabular-nums">{avg.toFixed(1)}</p>
            <Stars n={Math.round(avg)} className="relative mt-2" />
            <p className="relative mt-2 text-sm text-white/75">
              From {reviews.length} review{reviews.length === 1 ? "" : "s"}
              {verified ? ` · ${verified} verified` : ""}
            </p>
            <p className="relative mt-5 text-sm leading-relaxed text-white/85">Every review here is from someone who bought from us. We don&apos;t edit them.</p>
            <Link
              href="/shop"
              className="btn-shine relative mt-6 inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-[#e8c879] px-5 text-sm font-bold text-forest-deep transition-colors hover:bg-white"
            >
              Explore the store <ArrowRight className="size-4" />
            </Link>
          </motion.div>

          {/* Wall */}
          <div className="relative min-w-0 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            {reduce || reviews.length < 3 ? (
              <div className="flex flex-wrap gap-4">
                {reviews.map((r, i) => (
                  <ReviewCard key={r.id} r={r} i={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
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
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
