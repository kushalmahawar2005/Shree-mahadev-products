"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import { cldUrl } from "@/lib/image-loader";
import { HERO_HEIGHT, HERO_WIDTH, type HeroSlide } from "@/data/hero";
import { cn } from "@/lib/utils/cn";

const AUTOPLAY_MS = 5000;

/** Banner carousel: scroll-snap track (swipe on touch), autoplay with filling progress dots, slow Ken Burns zoom. */
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
            className="relative block w-full shrink-0 snap-center overflow-hidden"
            style={{ aspectRatio: `${HERO_WIDTH} / ${HERO_HEIGHT}` }}
          >
            <picture>
              {s.mobileSrc && <source media="(max-width: 639px)" srcSet={cldUrl(s.mobileSrc, 900)} />}
              <SmartImage
                src={s.src}
                alt={s.alt}
                width={HERO_WIDTH}
                height={HERO_HEIGHT}
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "auto"}
                sizes="(min-width: 1400px) 1360px, 100vw"
                className={cn(
                  "size-full object-cover transition-transform ease-linear",
                  // Ken Burns: the visible slide slowly zooms in; others reset instantly.
                  i === index ? "scale-[1.06] duration-[7000ms]" : "scale-100 duration-0",
                )}
              />
            </picture>
          </Link>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-6">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "relative h-1.5 overflow-hidden rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.35)] transition-all duration-500",
                i === index ? "w-12 bg-white/40" : "w-1.5 bg-white/80 hover:bg-white",
              )}
            >
              {/* Fills over the autoplay interval; pauses with the carousel */}
              {i === index && (
                <span
                  key={index}
                  className="hero-progress absolute inset-y-0 left-0 rounded-full bg-mustard"
                  style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
