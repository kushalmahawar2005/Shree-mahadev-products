"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

const COMPACT_AT = 80; // px scrolled before the header shrinks to its single compact row

const CompactContext = createContext(false);
/** True once the page is scrolled past COMPACT_AT (the header is in its compact row). */
export const useHeaderCompact = () => useContext(CompactContext);

/**
 * Sticky header with shrink-on-scroll:
 * - the header is `position: fixed`; a spacer in the page flow keeps the FULL header height, so the
 *   page content never moves when the header shrinks or grows (no layout jump, no scroll jitter)
 * - past COMPACT_AT the header switches to its compact row (children read `useHeaderCompact()` or
 *   style with `group-data-[compact]/header:`); scrolling back to the top restores it
 * - publishes `--sticky-top` (the header's current height) so other sticky bits sit right under it
 */
export function StickyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const [compact, setCompact] = useState(false);
  const [full, setFull] = useState(0);
  const el = useRef<HTMLElement>(null);
  // Until this time the header is animating back from compact: the spacer may only grow meanwhile.
  const expandingUntil = useRef(0);
  const remeasure = useRef<() => void>(() => {});

  // Measure the full (expanded) height for the spacer; keep --sticky-top in sync with the live height.
  useLayoutEffect(() => {
    const h = el.current;
    if (!h) return;
    // While expanding back from compact the height passes through in-between values: only grow the
    // spacer then. Otherwise follow the real height both ways (header got shorter: breakpoint change,
    // announcement strip hidden), so no empty gap is left under it.
    const write = () => {
      if (!h.dataset.compact) {
        const now = h.offsetHeight;
        setFull((f) => (Date.now() < expandingUntil.current ? Math.max(f, now) : now));
      }
      document.documentElement.style.setProperty("--sticky-top", `${h.offsetHeight}px`);
    };
    const onResize = () => remeasure.current();
    remeasure.current = () => {
      if (!h.dataset.compact) setFull(h.offsetHeight);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(h);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        // Menus/drawers lock scroll; don't flip state underneath them.
        if (document.documentElement.style.overflow !== "hidden") {
          const next = window.scrollY > COMPACT_AT;
          // Leaving compact: the header animates taller for a moment; let the spacer only grow meanwhile.
          if (!next && el.current?.dataset.compact) {
            expandingUntil.current = Date.now() + 700;
            // Animation done: settle the spacer on the real expanded height (it may have shrunk meanwhile).
            window.setTimeout(() => remeasure.current(), 750);
          }
          setCompact(next);
        }
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <CompactContext.Provider value={compact}>
      {/* Spacer: holds the full header height in the flow */}
      <div aria-hidden style={{ height: full || undefined }} className={cn(!full && "h-[112px] xl:h-[214px]")} />
      <header
        ref={el}
        data-compact={compact || undefined}
        className={cn("group/header fixed inset-x-0 top-0 z-40", className)}
      >
        {children}
      </header>
    </CompactContext.Provider>
  );
}
