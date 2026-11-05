"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Sticky header behaviour:
 * - compact after 24px of scroll
 * - hides on fast downward scroll, returns as soon as the user scrolls up
 * Exposes data-compact / data-hidden for styling children.
 */
export function StickyHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [compact, setCompact] = useState(false);
  const [hidden, setHidden] = useState(false);
  const last = useRef({ y: 0, t: 0 });
  const el = useRef<HTMLElement>(null);

  // Publish how much of the viewport the header covers, so other sticky bits (shop filters) sit right under it.
  useEffect(() => {
    const h = el.current;
    if (!h) return;
    const write = () => document.documentElement.style.setProperty("--sticky-top", `${hidden ? 0 : h.offsetHeight}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(h);
    return () => ro.disconnect();
  }, [hidden]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const now = performance.now();
        const dy = y - last.current.y;
        const dt = Math.max(1, now - last.current.t);
        const velocity = dy / dt; // px per ms

        setCompact(y > 24);
        // Menus/drawers lock scroll; never hide the header then.
        const locked = document.documentElement.style.overflow === "hidden";
        if (!locked) {
          if (y < 120 || dy < -4) setHidden(false);
          else if (dy > 0 && velocity > 0.6) setHidden(true);
        }
        last.current = { y, t: now };
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={el}
      data-compact={compact || undefined}
      data-hidden={hidden || undefined}
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "group/header sticky top-0 z-40 transition-transform duration-300 ease-[var(--ease-premium)] will-change-transform",
        hidden && "-translate-y-full",
        className,
      )}
    >
      {children}
    </header>
  );
}
