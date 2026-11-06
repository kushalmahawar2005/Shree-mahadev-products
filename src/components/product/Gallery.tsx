"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { ProductImage } from "@/lib/commerce/types";
import { cn } from "@/lib/utils/cn";

/** Product stage: swatch glow + crossfading image (swipe on touch, arrows/keys), thumbnail rail. Hand-built on motion. */
export function Gallery({ images, title, swatch = "#d0b17a", badge }: { images: ProductImage[]; title: string; swatch?: string; badge?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const reduce = useReducedMotion();
  const img = images[i];
  const many = images.length > 1;
  const go = (n: number) => {
    const next = (n + images.length) % images.length;
    setDir(next > i ? 1 : -1);
    setI(next);
  };
  if (!img) return null;

  return (
    <div>
      <div
        className="group relative aspect-square overflow-hidden rounded-[28px] border border-line bg-[#fbf6ec]"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} images`}
        tabIndex={many ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(i + 1);
          if (e.key === "ArrowLeft") go(i - 1);
        }}
      >
        <span aria-hidden className="absolute inset-[12%] rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${swatch}66 0%, transparent 70%)` }} />
        <span aria-hidden className="absolute inset-[10%] rounded-full border border-forest/5" />
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={img.url}
            custom={dir}
            className="absolute inset-0 grid place-items-center p-[8%]"
            initial={reduce ? false : { opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            drag={many ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(i + 1);
              else if (info.offset.x > 60) go(i - 1);
            }}
          >
            <SmartImage
              data-pdp-img=""
              src={img.url}
              alt={img.alt}
              width={img.width}
              height={img.height}
              priority={i === 0}
              sizes="(min-width: 1024px) 560px, 100vw"
              className="pointer-events-none size-full object-contain drop-shadow-[0_24px_30px_rgba(60,40,10,0.18)]"
            />
          </motion.div>
        </AnimatePresence>
        <span aria-hidden className="absolute bottom-[7%] left-1/2 h-3 w-2/5 -translate-x-1/2 rounded-[50%] bg-black/10 blur-md" />
        {badge && <div className="absolute top-4 left-4">{badge}</div>}

        {many && (
          <>
            {[
              { d: -1, I: ChevronLeft, cls: "left-3", label: "Previous image" },
              { d: 1, I: ChevronRight, cls: "right-3", label: "Next image" },
            ].map(({ d, I, cls, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => go(i + d)}
                aria-label={label}
                className={cn(
                  "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-forest shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 md:grid",
                  cls,
                )}
              >
                <I className="size-5" />
              </button>
            ))}
            <span className="absolute right-4 bottom-4 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-forest-text tabular-nums backdrop-blur">
              {i + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto">
          {images.map((im, n) => (
            <button
              key={im.url}
              type="button"
              onClick={() => go(n)}
              aria-label={`Show image ${n + 1}`}
              aria-current={n === i}
              className={cn(
                "grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 bg-[#fbf6ec] p-1.5 transition-colors",
                n === i ? "border-forest" : "border-transparent hover:border-line",
              )}
            >
              <SmartImage src={im.url} alt="" width={80} height={80} className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
