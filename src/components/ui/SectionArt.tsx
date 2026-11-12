"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { Art } from "@/data/brand-art";
import { cn } from "@/lib/utils/cn";

/**
 * A hand-painted decoration pinned to a section's edge (place inside a `relative overflow-hidden`
 * section, before the content). Drifts a few px against the scroll; still for reduced motion.
 * Purely decorative: hidden from assistive tech and never catches clicks.
 */
export function SectionArt({
  art,
  className,
  sizes = "(min-width: 768px) 420px, 240px",
  drift = 18,
}: {
  art: Art;
  /** Position + width, e.g. "-top-4 -left-6 w-[260px] md:w-[420px]". */
  className: string;
  sizes?: string;
  /** Max vertical drift in px while the section scrolls past. */
  drift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [drift, -drift]);

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute select-none", className)}
      style={reduce ? undefined : { y }}
    >
      <Image src={art.src} alt="" width={art.width} height={art.height} sizes={sizes} className="h-auto w-full" />
    </motion.div>
  );
}
