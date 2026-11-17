/**
 * Motion system for the chat widget. Every animation in src/components/chat uses these
 * tokens; CSS "ease", "ease-in-out" and "linear" are not used here.
 * Curves were tuned on cubic-bezier.com. Reduced motion: the widget wraps everything in
 * <MotionConfig reducedMotion="user">, which drops transforms and keeps opacity fades.
 */
import type { Transition, Variants } from "motion/react";

export const ease = {
  /** Things entering: panel, bubbles, cards. */
  outExpo: [0.16, 1, 0.3, 1],
  /** Small UI: chips, hover, press. */
  outQuart: [0.25, 1, 0.5, 1],
  /** Things moving on screen: layout shifts, progress bars. */
  inOutCubic: [0.65, 0, 0.35, 1],
  /** Exits only. */
  inQuart: [0.5, 0, 0.75, 0],
} as const;

/** Same curves for CSS (Tailwind arbitrary values / inline styles). */
export const cssEase = {
  outExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
  outQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
  inOutCubic: "cubic-bezier(0.65, 0, 0.35, 1)",
  inQuart: "cubic-bezier(0.5, 0, 0.75, 0)",
} as const;

/** Seconds. Nothing in the widget runs longer than 0.6s (looping idle cues excepted). */
export const dur = { micro: 0.12, small: 0.2, medium: 0.32, large: 0.45 } as const;

export const spring = {
  panel: { type: "spring", stiffness: 380, damping: 32 },
  press: { type: "spring", stiffness: 500, damping: 30 },
} as const satisfies Record<string, Transition>;

export const enter = (delay = 0): Transition => ({ duration: dur.medium, ease: ease.outExpo, delay });
export const exitFast: Transition = { duration: dur.small, ease: ease.inQuart };
export const small: Transition = { duration: dur.small, ease: ease.outQuart };
export const move: Transition = { duration: dur.medium, ease: ease.inOutCubic };

/** A bubble/card rising 8px and fading in. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: enter() },
};

/** Parent that staggers its `rise` children by 60ms. */
export const staggerParent = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Chips and tiles: lift 1px on hover, press to 0.97 with the press spring. */
export const tap = {
  whileHover: { y: -1, transition: small },
  whileTap: { scale: 0.97, transition: spring.press },
} as const;

/** Panel open/close: 0.96 → 1, fade, 8px rise from the bottom-right; exit faster than enter. */
export const panel = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring.panel },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: exitFast },
} as const;

/** Tab body swap. */
export const tabSwap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: enter() },
  exit: { opacity: 0, transition: { duration: dur.micro, ease: ease.inQuart } },
} as const;
