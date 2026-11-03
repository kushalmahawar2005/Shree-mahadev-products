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

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({
      prev: el.scrollLeft > 4,
      next: el.scrollLeft < max - 4,
      progress: max > 0 ? el.scrollLeft / max : 0,
      pages: Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth)),
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollLeft = 0;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active, update]);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  const uid = useId();
  const tabId = (i: number) => `${uid}-tab-${i}`;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Product groups"
        className={cn(
          "no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:px-0",
          variant === "center" ? "md:justify-center" : "justify-start",
        )}
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
                "min-h-11 shrink-0 px-5 text-sm font-semibold transition-colors duration-200",
                variant === "center" ? "rounded-md" : "rounded-md md:min-w-36",
                on
                  ? "bg-forest text-white"
                  : variant === "center"
                    ? "bg-forest/70 text-white hover:bg-forest-mid"
                    : "bg-khaki/60 text-forest-text hover:bg-khaki",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-6 md:mt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            role="tabpanel"
            aria-labelledby={tabId(active)}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              ref={track}
              className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:mx-0 md:gap-4 md:scroll-px-0 md:px-0"
            >
              {tab.products.map((p) => (
                <div
                  key={p.handle}
                  className="w-[68%] shrink-0 snap-start sm:w-[42%] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"
                >
                  <PickCard product={p} />
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <Arrow dir="prev" disabled={!edge.prev} onClick={() => go(-1)} />
        <Arrow dir="next" disabled={!edge.next} onClick={() => go(1)} />
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

function Arrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous products" : "Next products"}
      className={cn(
        "absolute top-[40%] hidden size-11 -translate-y-1/2 place-items-center text-forest-text transition-opacity duration-200 hover:text-forest disabled:opacity-25 md:grid",
        dir === "prev" ? "-left-12 xl:-left-14" : "-right-12 xl:-right-14",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
