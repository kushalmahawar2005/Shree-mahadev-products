/**
 * Storefront motion tokens: one source for durations, easings, offsets and stagger maths.
 * JS animations (motion/react) use the bezier arrays; CSS uses the `--ease-*` vars in globals.css,
 * which carry the same curves.
 */

type Bezier = readonly [number, number, number, number];

export const EASE = {
  ease: [0.25, 0.1, 0.25, 1] as Bezier, // CSS "ease"
  expoInOut: [1, 0, 0, 1] as Bezier,
  textUp: [0.5, 0.06, 0.01, 0.99] as Bezier,
  imgReveal: [0.65, 0, 0.35, 1] as Bezier,
  drawer: [0.75, 0, 0.175, 1] as Bezier,
  btnHover: [0.215, 0.61, 0.355, 1] as Bezier,
  menuSlide: [0.4, 0, 0.2, 1] as Bezier,
  menuOpen: [0.2, 0.7, 0.3, 1] as Bezier,
  /** General "settle in" (easeOutQuart) and "leave" (easeInQuart) curves for small UI motion. */
  out: [0.25, 1, 0.5, 1] as Bezier,
  in: [0.5, 0, 0.75, 0] as Bezier,
  /** Gentle back-and-forth loops (floating badges). */
  sine: [0.37, 0, 0.63, 1] as Bezier,
} as const;

/** Durations in seconds (motion's unit). */
export const DUR = {
  pageFade: 0.2,
  reveal: 0.6,
  heroWipe: 0.5,
  heroText: 0.45,
  heroAutoplay: 4,
  imgReveal: 0.5,
  maskLine: 0.3,
  bodyFade: 0.3,
  thumbs: 0.25,
  stickyBar: 0.25,
  megaMenu: 0.16,
  menuOpen: 0.26,
  menuClose: 0.2,
  cartDrawer: 0.6,
  modal: 0.25,
  loadingBar: 0.25,
} as const;

/** Stagger steps in seconds. */
export const STAGGER = {
  heroText: 0.1,
  maskLine: 0.12,
  linear: 0.1,
  thumbs: 0.1,
} as const;

export const MOBILE_BREAKPOINT = 1000;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scroll-reveal rise: 35px on small screens, 60px on large, 0 for reduced motion. */
export function revealOffset(): number {
  if (typeof window === "undefined" || prefersReducedMotion()) return 0;
  return window.innerWidth < MOBILE_BREAKPOINT ? 35 : 60;
}

/**
 * Decelerating stagger in ms: fast at first, then the cards bunch together.
 * 0, 97, 188, 273, 352, 425, ...
 */
export function staggerDecel(i: number): number {
  return 100 * i - Math.min(3 * i * i, 100 * i);
}

/** Plain linear stagger in ms (multi-column feature blocks). */
export function staggerLinear(i: number): number {
  return 100 * i;
}
