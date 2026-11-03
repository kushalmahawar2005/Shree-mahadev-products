"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import { HERO_HEIGHT, HERO_WIDTH, type HeroSlide } from "@/data/hero";
import { cn } from "@/lib/utils/cn";

const AUTOPLAY_MS = 5000;

/** Banner carousel: scroll-snap track (swipe on touch), autoplay, pill dots. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  }, []);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => goTo((index + 1) % slides.length), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [index, paused, slides.length, goTo]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      <div
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <Link
            key={s.src}
            href={s.href}
            aria-label={s.alt}
            tabIndex={i === index ? 0 : -1}
            className="relative block w-full shrink-0 snap-center"
            style={{ aspectRatio: `${HERO_WIDTH} / ${HERO_HEIGHT}` }}
          >
            <picture>
              {s.mobileSrc && <source media="(max-width: 639px)" srcSet={s.mobileSrc} />}
              <SmartImage
                src={s.src}
                alt={s.alt}
                width={HERO_WIDTH}
                height={HERO_HEIGHT}
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "auto"}
                sizes="(min-width: 1400px) 1360px, 100vw"
                className="size-full object-cover"
              />
            </picture>
          </Link>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-3 py-2 backdrop-blur-sm sm:bottom-5">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === index ? "w-8 bg-mustard" : "w-2 bg-white/90 hover:bg-white",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
