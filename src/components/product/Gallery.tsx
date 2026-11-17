"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion";
import { DUR, EASE, STAGGER, prefersReducedMotion } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn/dialog";
import { SmartImage, isPackshot } from "@/components/ui/SmartImage";
import type { ProductImage } from "@/lib/commerce/types";
import { variantImage } from "@/lib/image-loader";
import { cn } from "@/lib/utils/cn";
import { useVariantImage } from "./VariantImage";

export type GalleryVideo = { src: string; poster: string; label: string };

/**
 * Product stage: swatch glow + crossfading image (swipe on touch, arrows/keys), thumbnail rail,
 * optional short process video as the last slide (muted inline, loads only when opened). Hand-built on motion.
 */
/** Size slug in a photo's file name ("…/1l-front.jpg" → "1l"), or null for general photos (nutrition, label). */
const sizeOf = (url: string) => url.match(/\/(\d+(?:\.\d+)?(?:ml|l|g|kg))-[a-z0-9-]+\.[a-z0-9]+$/i)?.[1].toLowerCase() ?? null;

/** Only the chosen size's photos (+ general ones). No photo for that size yet: show everything. */
function forSize<T extends { url: string }>(all: T[], size?: string): T[] {
  if (!size) return all;
  const slug = size.toLowerCase().replace(/\s+/g, "");
  const own = all.filter((im) => sizeOf(im.url) === slug);
  return own.length ? all.filter((im) => sizeOf(im.url) === slug || sizeOf(im.url) === null) : all;
}

export function Gallery({
  images: all,
  title,
  swatch = "#d0b17a",
  badge,
  video,
}: {
  images: ProductImage[];
  title: string;
  swatch?: string;
  badge?: React.ReactNode;
  video?: GalleryVideo;
}) {
  const { size } = useVariantImage();
  const images = forSize(all, size);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState(false);
  const reduce = useReducedMotion();
  // New size picked in the buy box: the gallery now holds that size's photos; start on its front shot
  // (state adjusted during render, no effect needed).
  const [seenSize, setSeenSize] = useState(size);
  if (size !== seenSize) {
    setSeenSize(size);
    const match = variantImage(images, size);
    const n = match ? images.indexOf(match) : 0;
    setDir(n >= i ? 1 : -1);
    setI(Math.max(0, n));
  }
  const img = images[i];
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  // Page open: main image scales 1.1 → 1 and fades in once loaded; thumbnails slide in alongside
  // (from the side when they sit under the image, from below when they are a left column).
  useEffect(() => {
    // The main photo is the page's LCP: it is shown at once (no hidden-until-revealed state).
    const rail = thumbsRef.current;
    if (!rail) return;
    const items = [...rail.children] as HTMLElement[];
    const reduce = prefersReducedMotion();
    const column = window.innerWidth >= 1024;
    const from = reduce ? "none" : column ? "translateY(40px)" : "translateX(50px)";
    for (const t of items) Object.assign(t.style, { opacity: "0", transform: from });
    rail.setAttribute("data-revealed", "");
    void animate(items, { opacity: [0, 1], transform: [from, "none"] }, {
      duration: DUR.thumbs,
      ease: EASE.drawer,
      delay: (n: number) => (reduce ? 0 : n * STAGGER.thumbs),
    }).then(() => items.forEach((t) => (t.style.opacity = t.style.transform = "")));
  }, []);
  const total = images.length + (video ? 1 : 0);
  const many = total > 1;
  const isVideo = !!video && i === images.length;
  // Client packshots are 4:5 with their own backdrop: show them edge to edge, without the cut-out stage effects.
  const full = !img || isPackshot(img);
  const go = (n: number) => {
    const next = (n + total) % total;
    setDir(next > i ? 1 : -1);
    setI(next);
  };
  if (!images.length) return null;

  return (
    // Desktop: the stage width follows the viewport height (4:5 photo fits above the fold) and the
    // page grid gives the buy box whatever is left, so there's no dead gap between the two.
    <div className="lg:[--stage-w:min(calc((100svh-150px)*0.88),48vw,680px)]">
      <div
        ref={stageRef}
        className="group relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-[28px] border border-line bg-sunken sm:max-lg:aspect-auto sm:max-lg:h-[min(56svh,500px)] sm:max-lg:bg-[#fbf5e5] lg:w-[var(--stage-w)] lg:shrink-0"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} images`}
        tabIndex={many ? 0 : undefined}
        onPointerMove={(e) => {
          if (isVideo || e.pointerType !== "mouse" || window.innerWidth < 1024) return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onPointerLeave={() => setZoom(null)}
        onClick={(e) => {
          if (isVideo || (e.target as HTMLElement).closest("button")) return;
          setBox(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isVideo) setBox(true);
          if (e.key === "ArrowRight") go(i + 1);
          if (e.key === "ArrowLeft") go(i - 1);
        }}
      >
        {!full && !isVideo && (
          <>
            <span aria-hidden className="absolute inset-[12%] rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${swatch}66 0%, transparent 70%)` }} />
            <span aria-hidden className="absolute inset-[10%] rounded-full border border-forest/5" />
          </>
        )}
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={isVideo ? "video" : img!.url}
            custom={dir}
            className={cn("absolute inset-0 grid place-items-center", !full && "p-[3%]")}
            initial={reduce ? false : { opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            drag={many ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(i + 1);
              else if (info.offset.x > 60) go(i - 1);
            }}
          >
            {isVideo ? (
              <video
                src={video.src}
                poster={video.poster}
                autoPlay={!reduce}
                controls={!!reduce}
                muted
                loop
                playsInline
                preload="none"
                aria-label={video.label}
                className="size-full object-cover"
              />
            ) : (
            <SmartImage
              data-pdp-img=""
              src={img!.url}
              alt={img!.alt}
              width={img!.width}
              height={img!.height}
              preload={i === 0}
              sizes="(min-width: 1024px) 560px, 100vw"
              className={cn(
                "pointer-events-none transition-transform duration-200 ease-out",
                full
                  ? "size-full object-cover sm:max-lg:object-contain"
                  : "size-full object-contain drop-shadow-[0_24px_30px_rgba(60,40,10,0.18)]",
              )}
              style={zoom && !reduce ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            />
            )}
          </motion.div>
        </AnimatePresence>
        {!full && !isVideo && <span aria-hidden className="absolute bottom-[7%] left-1/2 h-3 w-2/5 -translate-x-1/2 rounded-[50%] bg-black/10 blur-md" />}
        {badge && <div className="absolute top-4 left-4">{badge}</div>}

        {many && (
          <>
            {[
              { d: -1, I: ChevronLeft, cls: "left-3", label: "Previous image" },
              { d: 1, I: ChevronRight, cls: "right-3", label: "Next image" },
            ].map(({ d, I, cls, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => go(i + d)}
                aria-label={label}
                className={cn(
                  "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-forest shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 md:grid",
                  cls,
                )}
              >
                <I className="size-5" />
              </button>
            ))}
            <span className="absolute right-4 bottom-4 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-forest-text tabular-nums backdrop-blur">
              {i + 1} / {total}
            </span>
          </>
        )}
      </div>

      <Dialog open={box && !!img} onOpenChange={setBox}>
        <DialogContent
          showCloseButton={false}
          className="max-w-none! h-[100svh] w-screen translate-none! top-0! left-0! rounded-none border-0 bg-page p-0"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(i + 1);
            if (e.key === "ArrowLeft") go(i - 1);
          }}
        >
          <DialogTitle className="sr-only">{title}, image {i + 1} of {total}</DialogTitle>
          {/* Native pinch-zoom + scroll on phones; swipe via the arrows / keys. */}
          <div className="grid size-full touch-pinch-zoom place-items-center overflow-auto">
            {img && <SmartImage src={img.url} alt={img.alt} width={img.width} height={img.height} sizes="100vw" className="h-auto max-h-full w-auto max-w-full object-contain" />}
          </div>
          <button type="button" onClick={() => setBox(false)} aria-label="Close" className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white text-ink shadow">
            <X className="size-5" />
          </button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => go(i - 1)} aria-label="Previous image" className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" onClick={() => go(i + 1)} aria-label="Next image" className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow">
                <ChevronRight className="size-5" />
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-ink tabular-nums shadow">
                {i + 1} / {total}
              </span>
            </>
          )}
        </DialogContent>
      </Dialog>

      {many && (
        <div ref={thumbsRef} data-pdp-thumbs="" className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto pb-1 lg:w-[var(--stage-w)]">
          {images.map((im, n) => (
            <button
              key={im.url}
              type="button"
              onClick={() => go(n)}
              aria-label={`Show image ${n + 1}`}
              aria-current={n === i}
              className={cn(
                "grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 bg-[#fbf5e5] transition-colors",
                n === i ? "border-forest" : "border-transparent hover:border-line",
              )}
            >
              <SmartImage src={im.url} alt="" width={128} height={160} className="size-full object-cover" />
            </button>
          ))}
          {video && (
            <button
              type="button"
              onClick={() => go(images.length)}
              aria-label={`Play video: ${video.label}`}
              aria-current={isVideo}
              className={cn(
                "relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 bg-sunken transition-colors",
                isVideo ? "border-forest" : "border-transparent hover:border-line",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny local poster, no optimisation needed */}
              <img src={video.poster} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
              <span className="relative grid size-7 place-items-center rounded-full bg-white/90 text-forest shadow-sm">
                <Play className="size-3.5 fill-current" />
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
