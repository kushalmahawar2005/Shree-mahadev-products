"use client";

import { MotionConfig } from "motion/react";

/**
 * Storefront-wide: when the shopper's OS asks for reduced motion, every motion/react animation drops
 * transforms (slides, scales) and keeps only opacity. CSS animations follow the global
 * prefers-reduced-motion rule in globals.css.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
