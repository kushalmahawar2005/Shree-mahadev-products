"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * Round "500+ Happy Families" seal on the PDP buy box (the client's artwork,
 * public/images/seal-500-families.webp, transparent).
 * Stamp animation the first time it scrolls into view: it drops in large and tilted, presses down
 * with a small bounce, and a faint ink ring spreads out, like a seal stamped on paper.
 * Still (no animation) for reduced motion.
 */
export function FamiliesSeal({ count, className }: { count: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative", className)}>
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-forest/40"
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: [0.9, 1.35], opacity: [0, 0.6, 0] }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: 0.42, duration: 0.7, ease: EASE.out }}
        />
      )}
      <motion.img
        src="/images/seal-500-families.webp?v=3"
        alt={`${count} happy families trust Mahadev Products`}
        width={320}
        height={318}
        loading="eager"
        className="relative size-full object-contain"
        initial={reduce ? false : { scale: 2.1, rotate: -28, opacity: 0, y: -18 }}
        whileInView={reduce ? undefined : { scale: [2.1, 0.9, 1.04, 1], rotate: [-28, -6, -8, -8], opacity: [0, 1, 1, 1], y: [-18, 0, 0, 0] }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.75, times: [0, 0.55, 0.78, 1], ease: EASE.out }}
      />
    </div>
  );
}
