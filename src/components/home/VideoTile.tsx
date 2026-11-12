"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Play, Volume2 } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { thumbUrl } from "@/lib/image-loader";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

/** True on devices with a real hover pointer (desktop); false on touch. */
function useCanHover() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(hover: hover)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(hover: hover)").matches,
    () => true,
  );
}

export type TileProduct = { href: string; title: string; image?: string; price?: number };

/**
 * One video tile of the brand-film showcase. All tiles share the same radius, bottom gradient,
 * glass play control (top-right) and glass product chip, so the film and reels read as one set.
 *
 * The video is absolutely positioned, so the tile's size comes only from its parent (aspect or
 * grid row) and never from the video's intrinsic size. It plays muted + looped only while on
 * screen (IntersectionObserver) and stays on its poster for reduced motion. Clicking the tile
 * calls `onOpen` (the parent shows the sound-on lightbox player).
 */
export function VideoTile({
  src,
  poster,
  title,
  subtitle,
  product,
  soundPill = false,
  compact = false,
  playOnHover = false,
  lazy = true,
  onOpen,
  className,
}: {
  /** Muted preview loop. Omit to show only the poster (e.g. a YouTube film). */
  src?: string;
  poster: string;
  title: string;
  subtitle?: string;
  product?: TileProduct;
  /** "Watch with sound" hint, used on the main film only. */
  soundPill?: boolean;
  /** Small reel card: light caption (hover-revealed title + compact pill) so the video stays the hero. */
  compact?: boolean;
  /** Desktop (hover pointer): play only while hovered, poster otherwise. Touch: play when mostly in view. */
  playOnHover?: boolean;
  /** Reels: don't fetch any video data until the tile nears the viewport. */
  lazy?: boolean;
  onOpen: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const canHover = useCanHover();
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    if (playOnHover && canHover) return; // desktop: driven by hover below
    // Touch reels use a high threshold so (with ~70vw cards) only one plays at a time.
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? void v.play().catch(() => {}) : v.pause()),
      { threshold: playOnHover ? 0.75 : 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduce, playOnHover, canHover]);

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce || !playOnHover || !canHover) return;
    if (hover) void v.play().catch(() => {});
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hover, reduce, playOnHover, canHover]);

  const chipPrice = product?.price ? formatMoney(product.price) : null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn("group relative isolate overflow-hidden rounded-3xl bg-forest ring-1 ring-white/10", className)}
    >
      {/* Whole tile opens the sound-on player; the product chip is its own link on top. */}
      <button type="button" onClick={onOpen} aria-label={`Play with sound: ${title}`} className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#e8c879] focus-visible:ring-inset">
        {src && !reduce ? (
          <video
            ref={ref}
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            preload={lazy ? "none" : "metadata"}
            disablePictureInPicture
            className="absolute inset-0 size-full object-cover transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:group-hover:scale-[1.03]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- poster can be a remote YouTube still
          <img src={poster} alt="" loading={lazy ? "lazy" : "eager"} className="absolute inset-0 size-full object-cover" />
        )}
        {compact ? (
          // Reels: shade only the bottom third, the rest of the frame stays clean
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        ) : (
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        )}
      </button>

      {/* Play control: same glass circle and corner on every tile (smaller on reels) */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-10 grid place-items-center rounded-full border border-white/15 text-white backdrop-blur-md transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110",
          compact ? "top-3 right-3 size-9 bg-black/30" : "top-4 right-4 size-10 bg-white/10",
        )}
      >
        <Play className={cn("ml-0.5 fill-white", compact ? "size-3.5" : "size-4")} />
      </span>

      {compact ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col items-start gap-2">
          {/* Title: revealed on hover with a pointer; always shown (small) on touch */}
          <motion.p
            initial={false}
            animate={!canHover || hover || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="line-clamp-1 max-w-full text-sm font-medium text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] lg:text-base"
          >
            {title}
          </motion.p>
          {product && (
            <Link
              href={product.href}
              title={chipPrice ? `${product.title} · ${chipPrice}` : product.title}
              className="group/chip pointer-events-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/35 p-1.5 pr-3 text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/15"
            >
              <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f6efe2]">
                {product.image ? (
                  <Image src={thumbUrl(product.image, 32)} alt="" width={32} height={32} unoptimized className="size-7 object-contain" />
                ) : (
                  <span className="size-1.5 rounded-full bg-forest" />
                )}
              </span>
              {/* One line when it fits; otherwise the price wraps under the name (never truncated) */}
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-1 leading-tight">
                <span className="text-sm font-medium">{product.title}</span>
                {chipPrice && <span className="text-xs whitespace-nowrap text-white/75">· {chipPrice}</span>}
              </span>
              <ArrowUpRight className="size-3.5 shrink-0 transition-transform duration-300 group-hover/chip:translate-x-0.5 group-hover/chip:-translate-y-0.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-4 md:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
              <p className={cn("font-bold text-white", soundPill ? "text-2xl md:text-[32px] md:leading-tight" : "text-[15px] leading-snug md:text-base")}>{title}</p>
              {subtitle && <p className="mt-1 text-sm text-white/80 md:text-base">{subtitle}</p>}
            </div>
            {soundPill && (
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md sm:inline-flex">
                <Volume2 className="size-3.5" /> Watch with sound
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
