"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useDragScroll } from "@/hooks/use-drag-scroll";

/** Horizontal snap row with plain chevrons outside the track (desktop) and swipe on mobile. */
export function ArrowRow({
  children,
  label,
  className,
  arrowTop = "50%",
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
  arrowTop?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useDragScroll(node); // desktop: drag the shelf with the mouse
  const reduce = useReducedMotion();
  const [edge, setEdge] = useState({ prev: false, next: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const go = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth, behavior: reduce ? "auto" : "smooth" });

  return (
    <div className="relative">
      <div
        ref={(el) => {
          ref.current = el;
          setNode(el);
        }}
        role="region"
        aria-label={label}
        className={cn(
          "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 md:mx-0 md:gap-4 md:scroll-px-0 md:px-0",
          className,
        )}
      >
        {children}
      </div>
      {(["prev", "next"] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => go(dir === "prev" ? -1 : 1)}
          disabled={dir === "prev" ? !edge.prev : !edge.next}
          aria-label={dir === "prev" ? `Previous: ${label}` : `Next: ${label}`}
          style={{ top: arrowTop }}
          data-dir={dir}
          className={cn(
            "arrow-swap absolute hidden overflow-hidden size-11 -translate-y-1/2 place-items-center text-forest-text transition-opacity duration-200 hover:text-forest disabled:opacity-25 md:grid",
            dir === "prev" ? "-left-12 xl:-left-14" : "-right-12 xl:-right-14",
          )}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
