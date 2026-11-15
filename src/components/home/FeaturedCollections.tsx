"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowUpRight } from "lucide-react";
import { Clock, Droplets, Leaf, Sprout, Wheat } from "@/components/icons/duo";
import { cn } from "@/lib/utils/cn";
import { SectionArt } from "@/components/ui/SectionArt";
import { TornEdge } from "@/components/ui/TornEdge";
import { deco } from "@/data/brand-art";

export type CategoryTile = {
  key: string;
  title: string;
  titleHi: string;
  blurb: string;
  /** Link when the category has products; omitted = "Coming soon". */
  href?: string;
  count?: number;
  unit?: string;
  /** Original catalog pack cutouts, one per product. */
  images: string[];
  /** Full-bleed styled scene (products on the right, empty left for copy). Replaces `images`. */
  cover?: string;
  /** Hand-painted scene (portrait), shown on the tile's right side and melting into the tone. */
  scene?: string;
  /** Styled stage photo (kept in data for a later showcase; unused by the bento). */
  stage?: string;
  /** Mood: background gradient + text colour, all from the brand palette family. */
  tone: { bg: string; ink: "light" | "dark"; glow: string };
  /** Bento size on desktop. */
  span: "hero" | "wide" | "small";
};

/** Sampled from the top edge of each category photo (phone crop). */
const PHONE_BG: Record<string, string> = { honey: "#cf9d38", jaggery: "#66320b", seeds: "#efd9bb", cake: "#5f4119" };

const SPAN = {
  hero: "lg:col-span-2 lg:row-span-2",
  wide: "lg:col-span-2",
  small: "lg:col-span-1",
};

/**
 * "Shop by category": bento grid of the six store categories. Each tile has its own colour mood,
 * a hand-painted scene, original catalog packs and a clear collection link.
 * Categories without products yet show a calm "Coming soon" state and are not links.
 */
export function FeaturedCollections({ tiles }: { tiles: CategoryTile[] }) {
  const reduce = useReducedMotion();
  if (!tiles.length) return null;

  return (
    <section className="paper-grain relative overflow-hidden bg-page pt-10 pb-8 md:py-20">
      <TornEdge color="var(--color-ivory)" />
      {/* Mustard branch bending in from the top-left */}
      <SectionArt art={deco.mustardBranch} className="-top-3 -left-8 w-[220px] opacity-95 md:-top-2 md:w-[400px] lg:w-[480px]" sizes="(min-width: 1024px) 480px, (min-width: 768px) 400px, 220px" />
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <div className="mb-6 flex flex-col items-center gap-1.5 text-center md:mb-10 md:gap-2">
          <p lang="hi" className="font-hindi inline-flex items-center gap-2 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-sm text-sale md:text-base">
            <span className="size-1.5 rounded-full bg-mustard" /> हमारी घानी से आपकी रसोई तक
          </p>
          <h2 className="text-[24px] md:text-[44px]">Shop by category</h2>
          <p className="max-w-xl text-sm text-ink-muted md:text-base">Everything we make, slow and honest. Pick where you want to start.</p>
        </div>

        <ul className="grid auto-rows-[168px] grid-cols-2 gap-2.5 sm:auto-rows-[240px] sm:gap-3 md:gap-4 lg:auto-rows-[250px] lg:grid-cols-4">
          {tiles.map((t, i) => {
            const light = t.tone.ink === "light";
            // Phones: oils (hero) full width, the other four as a 2×2 grid. Tablet keeps the old rule.
            const fullOnTablet = !!t.href || t.key === "cake" || t.key === "seeds";
            const phoneHalf = t.span !== "hero";
            const half = !fullOnTablet; // half-width tile on tablet
            // Sweeteners photo is square: keep it whole on the right instead of cropping it wide.
            const widePhoto = t.span === "wide" && t.key !== "jaggery";
            const body = (
              <>
                {/* colour mood + soft light */}
                <span aria-hidden className="absolute inset-0" style={{ background: t.tone.bg }} />
                {/* Phones: tile colour = the photo's own top colour, so the photo melts in with no pale band. */}
                {phoneHalf && PHONE_BG[t.key] && <span aria-hidden className="absolute inset-0 sm:hidden" style={{ background: PHONE_BG[t.key] }} />}
                <span
                  aria-hidden
                  className="absolute -right-10 -bottom-16 size-72 rounded-full opacity-70 blur-2xl transition-transform duration-700 group-hover:scale-125"
                  style={{ background: t.tone.glow }}
                />

                {/* Compose by the photograph's aspect ratio; preserve square product scenes and
                    give wide still lifes enough room without stretching their contents. */}
                {t.cover && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute right-0 bottom-0 transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.015] motion-reduce:transform-none [mask-image:linear-gradient(to_right,transparent,black_12%,black)]",
                      widePhoto ? "h-full w-full" : "aspect-square h-full",
                      (t.key === "honey" || t.key === "cake") && "max-lg:aspect-[5/2] max-lg:h-auto",
                      // square sweeteners photo in a wide tile: enlarge it (anchored bottom-right, tile clips the rest)
                      t.key === "jaggery" && "h-[150%]",
                      t.key === "oils" && "max-lg:h-auto max-lg:w-full max-lg:[mask-image:linear-gradient(to_bottom,transparent,black_12%,black)]",
                      phoneHalf && "max-sm:aspect-auto max-sm:h-[64%] max-sm:w-full max-sm:[mask-image:linear-gradient(to_bottom,transparent,black_22%,black)]",
                    )}
                  >
                    <Image src={t.cover} alt="" fill sizes="(min-width: 1360px) 640px, (min-width: 1024px) 50vw, 100vw" className={cn("object-right-bottom", widePhoto ? "object-cover" : "object-contain", phoneHalf && "max-sm:object-cover max-sm:object-[92%_100%]")} />
                  </span>
                )}

                {/* hand-painted scene on the right, faded into the tile colour on its left edge */}
                {!t.cover && t.scene && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 right-0 w-[62%] mask-l-from-45% transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.04]",
                      half && "max-lg:w-[80%]",
                      phoneHalf && "max-sm:inset-y-auto max-sm:bottom-0 max-sm:h-[58%] max-sm:w-full max-sm:mask-t-from-60%",
                      !t.href && "opacity-80",
                    )}
                  >
                    <Image src={t.scene} alt="" fill sizes="(min-width: 1024px) 420px, 50vw" className="object-cover object-[50%_18%]" />
                  </span>
                )}

                {/* no art yet: a large, faint category mark instead */}
                {!t.cover && !t.scene && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute right-6 bottom-4 transition-transform duration-700 group-hover:-rotate-6 group-hover:scale-110 [&>svg]:size-32 sm:[&>svg]:size-36",
                      half && "max-lg:right-3 max-lg:bottom-3 max-lg:[&>svg]:size-20",
                      light ? "text-white/15" : "text-forest/15",
                    )}
                  >
                    {t.key === "hair" ? <Droplets mono /> : t.key === "seeds" ? <Sprout mono /> : t.key === "cake" ? <Wheat mono /> : <Leaf mono />}
                  </span>
                )}

                {/* Phones: soft shade behind the title so it reads over the photo. */}
                {t.span === "hero" && t.cover && <span aria-hidden className="absolute inset-x-0 top-0 z-[5] h-1/3 bg-gradient-to-b from-black/35 to-transparent sm:hidden" />}

                {/* copy */}
                <span
                  className={cn(
                    "relative z-10 flex h-full flex-col p-4 md:p-6",
                    t.cover ? "max-w-full" : "max-w-[60%]",
                    half && "max-lg:max-w-full max-lg:p-3.5",
                    phoneHalf && "max-sm:max-w-full max-sm:p-3",
                  )}
                >
                  <span className={cn("font-hindi flex items-center gap-2 text-base leading-none md:text-lg", half && "max-lg:text-sm", phoneHalf && "max-sm:gap-1.5 max-sm:text-[12px]", light ? "text-[#e8c879]" : "text-sale")} lang="hi">
                    <span aria-hidden className={cn("h-px w-5", half && "max-lg:w-3", light ? "bg-[#e8c879]/70" : "bg-sale/60")} />
                    {t.titleHi}
                  </span>
                  <span
                    className={cn(
                      "mt-1 font-bold leading-tight",
                      t.span === "hero" ? "max-w-[85%] text-[22px] sm:text-[26px] md:max-w-[70%] md:text-[32px]" : "text-xl md:text-2xl",
                      half && "max-lg:text-lg",
                      phoneHalf && "max-sm:text-[15px]",
                      t.key === "jaggery" && "max-w-[190px]",
                      light ? "text-white" : "text-forest-text",
                    )}
                  >
                    {/* keep hyphenated words whole ("Wood-pressed" never splits at the hyphen) */}
                    {/* the space sits outside the nowrap span so the line can break between words */}
                    {t.title.split(" ").map((w, n) => (
                      <Fragment key={n}>
                        {n > 0 && " "}
                        <span className="whitespace-nowrap">{w}</span>
                      </Fragment>
                    ))}
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 line-clamp-3 text-[13px] leading-snug md:mt-2 md:text-sm",
                      half ? "max-lg:hidden" : t.span !== "hero" && "max-md:hidden",
                      "max-sm:hidden",
                      t.span === "small" && "lg:hidden",
                      t.cover && "max-w-[42%] max-lg:max-w-[85%]",
                      light ? "text-white/75" : "text-ink-muted",
                    )}
                  >
                    {t.blurb}
                  </span>

                  <span className={cn("mt-auto flex items-center gap-2", phoneHalf && "max-sm:mt-2")}>
                    {t.href ? (
                      <>
                        <span
                          className={cn(
                            "grid size-10 place-items-center rounded-full transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
                            half && "max-lg:size-9",
                            "max-sm:size-8",
                            light ? "bg-white text-forest" : "bg-forest text-white",
                          )}
                        >
                          <ArrowUpRight className="size-5 max-sm:size-4" />
                        </span>
                        {t.count ? (
                          <span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm max-sm:px-2 max-sm:py-1 max-sm:text-[10px]", light ? "bg-white/15 text-white" : "bg-white/70 text-forest-text")}>
                            {t.count} {t.unit}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", half && "max-lg:px-2.5 max-lg:text-[11px]", phoneHalf && "max-sm:px-2 max-sm:py-1 max-sm:text-[10px]", light ? "bg-white/15 text-white" : "bg-white/70 text-forest-text")}>
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
                className={cn(SPAN[t.span], fullOnTablet && "sm:max-lg:col-span-2", t.span === "hero" && "col-span-2 max-lg:row-span-2")}
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

        <div className="mt-6 flex justify-center md:mt-8">
          <Link
            href="/shop"
            className="btn-shine inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-forest px-5 text-xs md:h-12 md:px-7 md:text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-forest-mid"
          >
            Shop all products <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
