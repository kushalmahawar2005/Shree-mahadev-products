"use client";

import { animate } from "motion";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { DUR, EASE, STAGGER, prefersReducedMotion, revealOffset, staggerDecel, staggerLinear } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/*
 * Scroll reveals. Every reveal fires once, when its element enters the viewport.
 *
 * The hidden "before" state comes from CSS (globals.css, `html.js-motion …:not([data-revealed])`), so
 * nothing flashes between server HTML and hydration. `js-motion` is set by an inline script, so
 * without JS nothing is ever hidden; a fail-safe in the same script shows everything if the app
 * never hydrates. Reduced motion: no offsets/scale/stagger, opacity fades only.
 */

type Tag = "div" | "section" | "li" | "ul" | "header" | "article" | "ol" | "p" | "span" | "h1" | "h2" | "h3";

const FULL = "inset(0% 0% 0% 0%)";
const MASKED = "inset(0% 0% 100% 0%)";

/** Run `cb` once when `el` intersects; `threshold` may depend on the element size. */
function onceInView(el: Element, cb: () => void, opts: IntersectionObserverInit = {}) {
  if (!("IntersectionObserver" in window)) {
    cb();
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    cb();
  }, opts);
  io.observe(el);
  return () => io.disconnect();
}

/** Pin the hidden state inline, mark revealed (drops the CSS hide), animate, then clean up. */
async function play(
  targets: HTMLElement[],
  from: Record<string, string>,
  keyframes: Parameters<typeof animate>[1],
  options: Parameters<typeof animate>[2],
) {
  for (const t of targets) Object.assign(t.style, from);
  await animate(targets, keyframes, options);
  for (const t of targets) for (const k of Object.keys(from)) t.style.removeProperty(k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));
}

function useOnce<T extends HTMLElement>(run: (el: T) => (() => void) | void, deps: unknown[] = []) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.hasAttribute("data-revealed")) return;
    return run(el) ?? undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reveal runs once per mount
  }, deps);
  return ref;
}

/* ───────────────────────── Reveal ───────────────────────── */

/** Fade + rise (35px mobile / 60px desktop), 600ms "ease", once. */
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
  const ref = useOnce<HTMLElement>((el) =>
    onceInView(
      el,
      () => {
        const y = revealOffset();
        el.setAttribute("data-revealed", "");
        void play(
          [el],
          { opacity: "0", transform: `translateY(${y}px)` },
          { opacity: [0, 1], transform: [`translateY(${y}px)`, "translateY(0px)"] },
          { duration: DUR.reveal, ease: EASE.ease, delay: prefersReducedMotion() ? 0 : delay },
        );
      },
      { rootMargin: "0px 0px -40px 0px" },
    ),
  );
  const T = as as "div";
  return (
    <T ref={ref as React.Ref<HTMLDivElement>} data-reveal="" className={className} id={id}>
      {children}
    </T>
  );
}

/* ───────────────────────── StaggerGrid ───────────────────────── */

/**
 * Grid whose `[data-reveal-item]` children stay hidden until 50px of the grid is visible, then all
 * animate in parallel. `decel` (product/article cards): 0, 97, 188, 273ms… ; `linear` (feature
 * columns): 100ms steps.
 */
export function StaggerGrid({
  children,
  className,
  as = "div",
  variant = "decel",
}: {
  children: React.ReactNode;
  className?: string;
  as?: Tag;
  variant?: "decel" | "linear";
}) {
  const ref = useOnce<HTMLElement>((el) =>
    onceInView(
      el,
      () => {
        const items = [...el.querySelectorAll<HTMLElement>("[data-reveal-item]")].filter(
          (n) => n.closest("[data-stagger]") === el,
        );
        const y = revealOffset();
        const reduce = prefersReducedMotion();
        const step = variant === "decel" ? staggerDecel : staggerLinear;
        el.setAttribute("data-revealed", "");
        void play(
          items,
          { opacity: "0", transform: `translateY(${y}px)` },
          { opacity: [0, 1], transform: [`translateY(${y}px)`, "translateY(0px)"] },
          { duration: DUR.reveal, ease: EASE.ease, delay: (i: number) => (reduce ? 0 : step(i) / 1000) },
        );
      },
      // 50px of the grid visible (or all of it, if it is shorter than that).
      { threshold: Math.min(50 / Math.max(1, el.offsetHeight), 1) },
    ),
  );
  const T = as as "div";
  return (
    <T ref={ref as React.Ref<HTMLDivElement>} data-stagger="" className={className}>
      {children}
    </T>
  );
}

/** Back-compat name used across the site. Defaults to the card cascade. */
export const Stagger = StaggerGrid;

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

/* ───────────────────────── MaskedText ───────────────────────── */

/**
 * Text that rises line by line out of a mask. Words are wrapped individually; on reveal they are
 * grouped into their rendered lines (by offsetTop), so each visual line moves together whatever the
 * viewport width. opacity [0, .2, 1], translateY 100% → 0, clip inset → 0, 300ms textUp, 120ms per line.
 */
export function MaskedText({
  text,
  as = "span",
  className,
  delay = 0,
  manual = false,
}: {
  text: string;
  as?: Tag;
  className?: string;
  delay?: number;
  /** Let a parent sequence it (ImageTextReveal) instead of revealing on its own. */
  manual?: boolean;
}) {
  const ref = useOnce<HTMLElement>(
    (el) => (manual ? undefined : onceInView(el, () => void revealMasked(el, delay), { rootMargin: "0px 0px -40px 0px" })),
    [manual],
  );
  const T = as as "span";
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <T ref={ref as React.Ref<HTMLSpanElement>} data-masked="" className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom -mb-[0.12em]">
          <span data-mask-word="" className="inline-block">
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </T>
  );
}

/** Reveal a MaskedText root (or every `[data-masked]` inside `root`). Resolves when done. */
export async function revealMasked(root: HTMLElement, delay = 0) {
  const roots = root.hasAttribute("data-masked") ? [root] : [...root.querySelectorAll<HTMLElement>("[data-masked]")];
  const words = roots.flatMap((r) => [...r.querySelectorAll<HTMLElement>("[data-mask-word]")]);
  if (!words.length) return;
  const reduce = prefersReducedMotion();
  // Line index across all roots, in reading order.
  let line = -1;
  let lastTop = Number.NEGATIVE_INFINITY;
  const lineOf = words.map((w) => {
    const top = (w.parentElement as HTMLElement).getBoundingClientRect().top;
    if (Math.abs(top - lastTop) > 4) {
      line++;
      lastTop = top;
    }
    return line;
  });
  for (const r of roots) r.setAttribute("data-revealed", "");
  if (reduce) {
    await play(words, { opacity: "0" }, { opacity: [0, 1] }, { duration: DUR.maskLine, delay });
    return;
  }
  await play(
    words,
    { opacity: "0", transform: "translateY(100%)", clipPath: MASKED },
    { opacity: [0, 0.2, 1], transform: ["translateY(100%)", "translateY(0%)"], clipPath: [MASKED, FULL] },
    { duration: DUR.maskLine, ease: EASE.textUp, delay: (i: number) => delay + lineOf[i] * STAGGER.maskLine },
  );
}

/* ───────────────────────── ImageReveal ───────────────────────── */

function whenLoaded(img: HTMLImageElement | null) {
  return new Promise<void>((resolve) => {
    if (!img || (img.complete && img.naturalWidth > 0)) return resolve();
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

/** Reveal the first image inside `root`: opacity 0→1, scale 1.1→1, 500ms imgReveal. */
export async function revealImage(root: HTMLElement) {
  const img = root.querySelector<HTMLImageElement>("img");
  await whenLoaded(img);
  const target = (root.querySelector<HTMLElement>("[data-img-target]") ?? img ?? root) as HTMLElement;
  root.setAttribute("data-revealed", "");
  const reduce = prefersReducedMotion();
  await play(
    [target],
    reduce ? { opacity: "0" } : { opacity: "0", transform: "scale(1.1)" },
    reduce ? { opacity: [0, 1] } : { opacity: [0, 1], transform: ["scale(1.1)", "scale(1)"] },
    { duration: DUR.imgReveal, ease: EASE.imgReveal },
  );
}

/** Wrapper that reveals its image once it is in view and loaded. Clips the 1.1 scale. */
export function ImageReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useOnce<HTMLDivElement>((el) => onceInView(el, () => void revealImage(el), { threshold: 0.15 }));
  return (
    <div ref={ref} data-img-reveal="" className={cn("overflow-hidden", className)}>
      {children}
    </div>
  );
}

/* ───────────────────────── ImageTextReveal (banner) ───────────────────────── */

/**
 * Full-width promo banner sequence, once in view AND the image has loaded:
 *   a) image (ImageReveal timing) → b) every MaskedText inside `[data-banner-content]`
 *   → c) `[data-banner-body]` (copy + buttons) fades in, 300ms.
 * Put the image inside `[data-banner-img]`; give MaskedText `manual`.
 * `parallax` (off by default): image drifts 100px → 0 through the viewport and the content fades
 * out as the section leaves (opacity 1 − 3 × scrolled-out ratio).
 */
export function ImageTextReveal({
  children,
  className,
  parallax = false,
}: {
  children: React.ReactNode;
  className?: string;
  parallax?: boolean;
}) {
  const ref = useOnce<HTMLElement>((el) =>
    onceInView(
      el,
      () => {
        void (async () => {
          const img = el.querySelector<HTMLElement>("[data-banner-img]");
          if (img) await revealImage(img);
          const content = el.querySelector<HTMLElement>("[data-banner-content]") ?? el;
          await revealMasked(content);
          const body = [...el.querySelectorAll<HTMLElement>("[data-banner-body]")];
          el.setAttribute("data-revealed", "");
          if (body.length) await play(body, { opacity: "0" }, { opacity: [0, 1] }, { duration: DUR.bodyFade, ease: EASE.ease });
        })();
      },
      { threshold: 0.2 },
    ),
  );
  return (
    <section ref={ref as React.Ref<HTMLElement>} data-banner="" className={cn("relative overflow-hidden", className)}>
      {parallax ? <ParallaxLayers target={ref}>{children}</ParallaxLayers> : children}
    </section>
  );
}

function ParallaxLayers({ target, children }: { target: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const { scrollYProgress: leaving } = useScroll({ target, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);
  const opacity = useTransform(leaving, (p) => Math.max(0, 1 - 3 * p));
  return (
    <motion.div style={{ "--banner-y": useTransform(y, (v) => `${v}px`), "--banner-o": opacity } as never} className="contents [&_[data-banner-img]]:translate-y-[var(--banner-y)] [&_[data-banner-content]]:opacity-[var(--banner-o)] motion-reduce:[&_[data-banner-img]]:translate-y-0 motion-reduce:[&_[data-banner-content]]:opacity-100">
      {children}
    </motion.div>
  );
}
