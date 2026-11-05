"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Clock, Droplets, Leaf, Sprout, Wheat } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type CategoryTile = {
  key: string;
  title: string;
  titleHi: string;
  blurb: string;
  /** Link when the category has products; omitted = "Coming soon". */
  href?: string;
  count?: number;
  unit?: string;
  /** Up to 3 product photos, fanned out in the tile. */
  images: string[];
  /** Mood: background gradient + text colour, all from the brand palette family. */
  tone: { bg: string; ink: "light" | "dark"; glow: string };
  /** Bento size on desktop. */
  span: "hero" | "wide" | "small";
};

const SPAN = {
  hero: "lg:col-span-2 lg:row-span-2",
  wide: "lg:col-span-2",
  small: "lg:col-span-1",
};

/**
 * "Shop by category": bento grid of the six store categories. Each tile has its own colour mood,
 * fanned product photos that lift on hover, a count chip and an arrow that spins. Categories
 * without products yet show a calm "Coming soon" state and are not links.
 */
export function FeaturedCollections({ tiles }: { tiles: CategoryTile[] }) {
  const reduce = useReducedMotion();
  if (!tiles.length) return null;

  return (
    <section className="paper-grain relative overflow-hidden bg-[#F5EDDE] py-14 md:py-20">
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <div className="mb-8 flex flex-col items-center gap-2 text-center md:mb-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">
            <span className="size-1.5 rounded-full bg-mustard" /> From our ghani to your rasoi
          </p>
          <h2 className="text-3xl md:text-[44px]">Shop by category</h2>
          <p className="max-w-xl text-ink-muted">Everything we make, slow and honest. Pick where you want to start.</p>
        </div>

        <ul className="grid auto-rows-[220px] grid-cols-2 gap-3 md:gap-4 lg:auto-rows-[230px] lg:grid-cols-4">
          {tiles.map((t, i) => {
            const light = t.tone.ink === "light";
            const body = (
              <>
                {/* colour mood + soft light */}
                <span aria-hidden className="absolute inset-0" style={{ background: t.tone.bg }} />
                <span
                  aria-hidden
                  className="absolute -right-10 -bottom-16 size-72 rounded-full opacity-70 blur-2xl transition-transform duration-700 group-hover:scale-125"
                  style={{ background: t.tone.glow }}
                />

                {/* fanned product photos */}
                {t.images.length > 0 && (
                  <span aria-hidden className={cn("absolute right-[4%] bottom-0 flex items-end", t.span === "hero" ? "h-[86%] w-[68%]" : "h-[80%] w-[56%]")}>
                    {t.images.slice(0, 3).map((src, n) => (
                      <span
                        key={src + n}
                        className="relative -ml-[18%] h-full flex-1 transition-transform duration-500 ease-[var(--ease-premium)] first:ml-0 group-hover:-translate-y-2"
                        style={{
                          transform: `rotate(${(n - 1) * 7}deg) translateY(${n === 1 ? 0 : 6}%)`,
                          zIndex: n === 1 ? 2 : 1,
                          transitionDelay: `${n * 60}ms`,
                        }}
                      >
                        <Image src={src} alt="" fill sizes="200px" className="object-contain object-bottom drop-shadow-[0_14px_16px_rgba(0,0,0,0.28)]" />
                      </span>
                    ))}
                  </span>
                )}

                {/* no photos yet: a large, faint category mark instead */}
                {t.images.length === 0 && (
                  <span aria-hidden className={cn("absolute right-6 bottom-4 transition-transform duration-700 group-hover:-rotate-6 group-hover:scale-110", light ? "text-white/15" : "text-forest/15")}>
                    {t.key === "hair" ? <Droplets className="size-32" strokeWidth={1.25} /> : t.key === "seeds" ? <Sprout className="size-36" strokeWidth={1.25} /> : t.key === "cake" ? <Wheat className="size-36" strokeWidth={1.25} /> : <Leaf className="size-32" strokeWidth={1.25} />}
                  </span>
                )}

                {/* copy */}
                <span className={cn("relative z-10 flex h-full flex-col p-4 md:p-6", t.span === "wide" && t.images.length ? "max-w-[46%]" : "max-w-[60%]")}>
                  <span className={cn("font-hindi flex items-center gap-2 text-base leading-none md:text-lg", light ? "text-[#e8c879]" : "text-sale")} lang="hi">
                    <span aria-hidden className={cn("h-px w-5", light ? "bg-[#e8c879]/70" : "bg-sale/60")} />
                    {t.titleHi}
                  </span>
                  <span className={cn("mt-1 font-bold leading-tight", t.span === "hero" ? "text-3xl md:text-4xl" : "text-xl md:text-2xl", light ? "text-white" : "text-forest-text")}>
                    {t.title}
                  </span>
                  <span className={cn("mt-2 hidden text-sm leading-snug md:block", t.span === "small" && "lg:hidden", light ? "text-white/75" : "text-ink-muted")}>{t.blurb}</span>

                  <span className="mt-auto flex items-center gap-2">
                    {t.href ? (
                      <>
                        <span
                          className={cn(
                            "grid size-10 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45",
                            light ? "bg-white text-forest" : "bg-forest text-white",
                          )}
                        >
                          <ArrowUpRight className="size-5" />
                        </span>
                        {t.count ? (
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm", light ? "bg-white/15 text-white" : "bg-white/70 text-forest-text")}>
                            {t.count} {t.unit}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", light ? "bg-white/15 text-white" : "bg-white/70 text-forest-text")}>
                        <Clock className="size-3.5" /> Coming soon
                      </span>
                    )}
                  </span>
                </span>
              </>
            );
            const cls = cn(
              "group relative block h-full overflow-hidden rounded-3xl ring-1 ring-black/5 transition-shadow duration-500",
              t.href ? "hover:shadow-[0_30px_50px_-30px_rgba(7,47,27,0.6)]" : "cursor-default",
            );
            return (
              <motion.li
                key={t.key}
                className={cn(SPAN[t.span], t.span === "hero" && "col-span-2 row-span-2", t.span === "wide" && "col-span-2")}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                {t.href ? (
                  <Link href={t.href} className={cls} aria-label={`${t.title}${t.count ? `, ${t.count} ${t.unit}` : ""}`}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls} aria-label={`${t.title}, coming soon`}>
                    {body}
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>

        <div className="mt-8 flex justify-center">
          <Link
            href="/shop"
            className="btn-shine inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-forest px-7 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-forest-mid"
          >
            Shop all products <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
