"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PickCard, type PickProduct } from "./PickCard";

export type CarouselTab = { label: string; viewAll: string; products: PickProduct[] };

/**
 * Tabs + 4-up product carousel (Two Brothers "Top Picks" / "Shop By Concern").
 * Arrows sit outside the track on desktop; mobile swipes with scroll-snap.
 */
export function TabbedCarousel({
  tabs,
  variant = "center",
}: {
  tabs: CarouselTab[];
  variant?: "center" | "left";
}) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: true, progress: 0, pages: 1, ratio: 1 });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({
      prev: el.scrollLeft > 4,
      next: el.scrollLeft < max - 4,
      progress: max > 0 ? el.scrollLeft / max : 0,
      pages: Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth)),
      ratio: el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
    });
  }, []);

  // The track remounts on every tab switch (AnimatePresence), so wire it up via a callback ref.
  const ro = useRef<ResizeObserver | null>(null);
  const setTrack = useCallback(
    (el: HTMLDivElement | null) => {
      ro.current?.disconnect();
      track.current = el;
      if (!el) return;
      requestAnimationFrame(update);
      // Images loading change card height: keep arrows centred on the photo.
      ro.current = new ResizeObserver(update);
      ro.current.observe(el);
    },
    [update],
  );

  useEffect(() => {
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  // Move by exactly one card (its width + the flex gap).
  const go = (dir: 1 | -1) => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (first.offsetWidth + gap), behavior: reduce ? "auto" : "smooth" });
  };
  const [hold, setHold] = useState(false);

  // Autoplay: one card every 5 s, back to the start at the end. Pauses on hover/touch/focus.
  useEffect(() => {
    if (reduce || hold) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) el.scrollTo({ left: 0, behavior: "smooth" });
      else go(1);
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go reads the live track ref
  }, [reduce, hold, active]);

  const uid = useId();
  const tabId = (i: number) => `${uid}-tab-${i}`;

  return (
    <div>
      <div className={cn("relative flex items-center", variant === "center" ? "justify-center" : "justify-start")}>
        <div
          role="tablist"
          aria-label="Product groups"
          className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-khaki-soft p-1"
        >
          {tabs.map((t, i) => {
            const on = i === active;
            return (
              <button
                key={t.label}
                id={tabId(i)}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => setActive(i)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
                  on ? "bg-white text-forest-text shadow-[0_1px_3px_rgba(7,47,27,0.15)]" : "text-forest-text/70 hover:text-forest-text",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative mt-6 md:mt-8"
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onTouchStart={() => setHold(true)}
        onFocusCapture={() => setHold(true)}
        onBlurCapture={() => setHold(false)}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            role="tabpanel"
            aria-labelledby={tabId(active)}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div
              ref={setTrack}
              onScroll={update}
              className={cn(
                "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:mx-0 md:gap-4 md:scroll-px-0 md:px-0",
                // Fewer cards than a row: centre them instead of leaving a gap on the right.
                tab.products.length < 4 && "lg:justify-center",
                tab.products.length < 3 && "md:justify-center",
              )}
            >
              {tab.products.map((p) => (
                <div
                  key={p.handle}
                  className="w-[44%] shrink-0 snap-start sm:w-[31%] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"
                >
                  <PickCard product={p} />
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

      </div>

      {/* Scroll progress (drag or click to scroll) + See all pill */}
      <div className="mt-6 flex items-center gap-4 md:mt-8 md:gap-6">
        {edge.ratio < 0.999 ? (
          <ScrollProgress
            progress={edge.progress}
            ratio={edge.ratio}
            onSeek={(p) => {
              const el = track.current;
              if (!el) return;
              el.scrollTo({ left: p * (el.scrollWidth - el.clientWidth), behavior: "auto" });
            }}
          />
        ) : (
          <span className="flex-1" />
        )}
        <Link
          href={tab.viewAll}
          aria-label={`See all ${tab.label} products`}
          className="group/see inline-flex h-12 shrink-0 items-center gap-2 rounded-full border border-line bg-white pr-5 pl-6 text-[15px] font-bold text-forest-text shadow-[0_6px_18px_-12px_rgba(7,47,27,0.35)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-[0_14px_28px_-16px_rgba(7,47,27,0.45)]"
        >
          See All
          <span className="relative grid size-5 place-items-center overflow-hidden">
            <ArrowRight className="size-[18px] transition-transform duration-300 ease-[var(--ease-btn-hover)] group-hover/see:translate-x-[140%]" />
            <ArrowRight className="absolute size-[18px] -translate-x-[140%] transition-transform duration-300 ease-[var(--ease-btn-hover)] group-hover/see:translate-x-0" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Thin track with a thumb sized to the visible share of the carousel. The thumb follows scrolling;
 * press/drag anywhere on the track to scroll there.
 */
function ScrollProgress({ progress, ratio, onSeek }: { progress: number; ratio: number; onSeek: (p: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const seek = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const thumb = r.width * ratio;
    const p = (clientX - r.left - thumb / 2) / Math.max(1, r.width - thumb);
    onSeek(Math.min(1, Math.max(0, p)));
  };
  return (
    <div
      ref={ref}
      aria-hidden // visual aid only; the cards stay reachable by swipe, scroll and keyboard
      className="group/bar relative h-5 flex-1 cursor-pointer touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e.clientX);
      }}
    >
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-forest/10 transition-[height] duration-200 group-hover/bar:h-1.5" />
      <span
        className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-forest transition-[height] duration-200 will-change-transform group-hover/bar:h-1.5"
        style={{ width: `${ratio * 100}%`, transform: `translate(${progress * (1 / ratio - 1) * 100}%, -50%)` }}
      />
    </div>
  );
}
