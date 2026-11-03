"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  showDots = false,
}: {
  tabs: CarouselTab[];
  variant?: "center" | "left";
  showDots?: boolean;
}) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: true, progress: 0, pages: 1 });
  const [arrowTop, setArrowTop] = useState<number | null>(null);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // Centre the arrows on the product photo, not the whole card.
    const media = el.querySelector<HTMLElement>("[data-card-media]");
    if (media) setArrowTop(media.getBoundingClientRect().top - el.getBoundingClientRect().top + media.offsetHeight / 2);
    setEdge({
      prev: el.scrollLeft > 4,
      next: el.scrollLeft < max - 4,
      progress: max > 0 ? el.scrollLeft / max : 0,
      pages: Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth)),
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
  const canScroll = edge.prev || edge.next;

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
        {/* 1024–1279px: arrows sit as a pair at the end of the tabs row */}
        {canScroll && (
          <div className="absolute right-0 hidden gap-2 lg:flex xl:hidden">
            <Arrow dir="prev" disabled={!edge.prev} onClick={() => go(-1)} />
            <Arrow dir="next" disabled={!edge.next} onClick={() => go(1)} />
          </div>
        )}
      </div>

      <div className="relative mt-6 md:mt-8">
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

        {/* ≥1280px: arrows outside the track, 24px from the first/last card, centred on the photo */}
        {canScroll && (
          <>
            <Arrow dir="prev" side top={arrowTop} disabled={!edge.prev} onClick={() => go(-1)} />
            <Arrow dir="next" side top={arrowTop} disabled={!edge.next} onClick={() => go(1)} />
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        {showDots && edge.pages > 1 ? (
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: edge.pages }, (_, i) => {
              const on = Math.round(edge.progress * (edge.pages - 1)) === i;
              return (
                <span
                  key={i}
                  className={cn("h-1.5 rounded-full transition-all duration-300", on ? "w-6 bg-forest" : "w-1.5 bg-khaki")}
                />
              );
            })}
          </div>
        ) : (
          <span />
        )}
        <Link
          href={tab.viewAll}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest-text hover:underline"
        >
          View all {tab.label} products
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function Arrow({
  dir,
  side = false,
  top = null,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  side?: boolean;
  top?: number | null;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={dir === "prev" ? "Previous products" : "Next products"}
      style={side ? { top: top ?? "35%" } : undefined}
      className={cn(
        "size-11 place-items-center rounded-full border border-khaki bg-white text-forest transition-opacity duration-200 hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mustard disabled:pointer-events-none disabled:opacity-35",
        side ? "absolute z-10 hidden -translate-y-1/2 xl:grid" : "grid",
        side && (dir === "prev" ? "-left-[68px]" : "-right-[68px]"),
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
