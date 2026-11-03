"use client";

import { animate, stagger as staggerFn } from "motion";
import { useEffect, useRef } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

type Tag = "div" | "section" | "li" | "ul" | "header" | "article" | "ol";

/**
 * Fade + 24px rise when the element enters the viewport. Runs once.
 *
 * Content is rendered fully visible on the server. After hydration, only elements
 * that are still *below the fold* get hidden and then revealed on scroll. If JS
 * fails, or the user prefers reduced motion, nothing is ever hidden.
 */
function useReveal<T extends HTMLElement>(opts: { stagger?: number; delay?: number }) {
  const ref = useRef<T>(null);
  const { stagger, delay = 0 } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const targets: HTMLElement[] =
      stagger !== undefined
        ? Array.from(el.querySelectorAll<HTMLElement>("[data-reveal-item]"))
        : [el];
    if (!targets.length) return;

    // Already on screen at mount: leave it alone (no flash).
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    for (const t of targets) {
      t.style.opacity = "0";
      t.style.transform = "translateY(24px)";
    }
    let done = false;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        done = true;
        io.disconnect();
        animate(
          targets,
          { opacity: [0, 1], transform: ["translateY(24px)", "translateY(0px)"] },
          {
            duration: 0.6,
            ease: EASE,
            delay: stagger !== undefined ? staggerFn(stagger, { startDelay: delay }) : delay,
          },
        );
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (!done) {
        for (const t of targets) {
          t.style.opacity = "";
          t.style.transform = "";
        }
      }
    };
  }, [stagger, delay]);

  return ref;
}

export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  as?: Tag;
  delay?: number;
  id?: string;
}) {
  const ref = useReveal<HTMLElement>({ delay });
  const T = as as "div";
  return (
    <T ref={ref as React.Ref<HTMLDivElement>} className={className} id={id}>
      {children}
    </T>
  );
}

/** Parent for staggered children. Mark children with <StaggerItem> (0.06s apart). */
export function Stagger({
  children,
  className,
  as = "div",
  stagger = 0.06,
}: {
  children: React.ReactNode;
  className?: string;
  as?: Tag;
  stagger?: number;
}) {
  const ref = useReveal<HTMLElement>({ stagger });
  const T = as as "div";
  return (
    <T ref={ref as React.Ref<HTMLDivElement>} className={className}>
      {children}
    </T>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: Tag;
}) {
  const T = as as "div";
  return (
    <T data-reveal-item="" className={className}>
      {children}
    </T>
  );
}
