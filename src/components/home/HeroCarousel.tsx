"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAnimate } from "motion/react";
import { SmartImage } from "@/components/ui/SmartImage";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cldUrl } from "@/lib/image-loader";
import { HERO_HEIGHT, HERO_WIDTH, type HeroSlide } from "@/data/hero";
import { cn } from "@/lib/utils/cn";
import { DUR, EASE, STAGGER } from "@/lib/motion";

const AUTOPLAY_S = DUR.heroAutoplay;
const WIPE = { duration: DUR.heroWipe, ease: EASE.expoInOut }; // slow start, very fast middle, soft stop
const TEXT_IN = { duration: DUR.heroText, ease: EASE.textUp };
const TEXT_STAGGER = STAGGER.heroText;
const FULL = "inset(0% 0% 0% 0%)";
const FROM_RIGHT = "inset(0% 0% 0% 100%)"; // NEXT: reveals from the right edge toward the left
const FROM_LEFT = "inset(0% 100% 0% 0%)"; // PREVIOUS: reveals from the left edge toward the right

type Dir = 1 | -1;

/**
 * Full-width hero slideshow with a "sweep" transition:
 * the leaving slide stays still underneath for 500ms while its text fades out; the entering slide is
 * revealed by a hard-edged clip-path wipe (500ms, cubic-bezier(1,0,0,1)); after the wipe, its text
 * rises line by line from masks (450ms, 100ms stagger). Autoplay is driven by each progress bar's
 * finish, so bar and slide never drift. Pauses when offscreen, when the tab is hidden and on hover. Swipe, arrow keys, reduced-motion fade. Built on motion's useAnimate; no slider library.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [current, setCurrent] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [run, setRun] = useState({ id: 0, dir: 1 as Dir });
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const reduce = useReducedMotion();
  const transitioning = useRef(false);
  const startX = useRef<number | null>(null);
  // Pauses offscreen, in a hidden tab and while the pointer rests on the hero.
  const playing = onScreen && tabVisible && !hovered;
  const many = slides.length > 1;
  const hasMobile = slides.some((s) => s.mobileSrc);

  const slideEl = (i: number) => scope.current?.querySelector<HTMLElement>(`[data-slide="${i}"]`) ?? null;
  const textEls = (i: number) => [...(slideEl(i)?.querySelectorAll<HTMLElement>("[data-hero-text]") ?? [])];

  const goTo = useCallback(
    (to: number, dir?: Dir) => {
      if (!many || transitioning.current) return;
      const next = (to + slides.length) % slides.length;
      if (next === current) return;
      transitioning.current = true;
      setLeaving(current);
      setCurrent(next);
      setRun((r) => ({ id: r.id + 1, dir: dir ?? (next > current ? 1 : -1) }));
    },
    [current, many, slides.length],
  );

  // Before paint: put the entering slide in its "closed" state, so it never flashes fully open.
  useLayoutEffect(() => {
    if (run.id === 0) return;
    const el = slideEl(current);
    if (!el) return;
    if (reduce) el.style.opacity = "0";
    else {
      el.style.clipPath = run.dir === 1 ? FROM_RIGHT : FROM_LEFT;
      for (const t of textEls(current)) Object.assign(t.style, { opacity: "0", clipPath: "inset(0% 0% 100% 0%)", transform: "translateY(100%)" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per transition
  }, [run.id]);

  // The sweep sequence: wipe in (leaving text fades meanwhile) → hide the leaving slide → stagger text in.
  useEffect(() => {
    if (run.id === 0) return;
    const enter = slideEl(current);
    const prev = leaving;
    if (!enter) return;
    let cancelled = false;
    (async () => {
      if (reduce) {
        await animate(enter, { opacity: [0, 1] }, { duration: 0.25, ease: "easeInOut" });
      } else {
        const outText = prev === null ? [] : textEls(prev);
        await Promise.all([
          animate(enter, { clipPath: [run.dir === 1 ? FROM_RIGHT : FROM_LEFT, FULL] }, WIPE),
          outText.length ? animate(outText, { opacity: 0 }, { duration: 0.25, ease: "easeInOut" }) : null,
        ]);
      }
      if (cancelled) return;
      setLeaving(null); // leaving slide becomes visibility:hidden after the 500ms wipe
      transitioning.current = false;
      if (!reduce) {
        const ins = textEls(current);
        if (ins.length)
          await animate(
            ins,
            { opacity: [0, 1], clipPath: ["inset(0% 0% 100% 0%)", FULL], transform: ["translateY(100%)", "translateY(0%)"] },
            { ...TEXT_IN, delay: (i: number) => i * TEXT_STAGGER },
          );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per transition
  }, [run.id]);

  // First load: the first slide's text rises in too.
  useEffect(() => {
    if (reduce) return;
    const ins = textEls(0);
    if (ins.length)
      animate(
        ins,
        { opacity: [0, 1], clipPath: ["inset(0% 0% 100% 0%)", FULL], transform: ["translateY(100%)", "translateY(0%)"] },
        { ...TEXT_IN, delay: (i: number) => 0.2 + i * TEXT_STAGGER },
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Pause when the hero is offscreen or the tab is hidden.
  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [scope]);

  return (
    <div
      ref={scope}
      className={cn(
        "relative w-full overflow-hidden bg-[#f3ead8] outline-none",
        hasMobile ? "aspect-[4/5] md:aspect-[var(--hero-ratio)]" : "aspect-[var(--hero-ratio)]",
      )}
      style={{ "--hero-ratio": `${HERO_WIDTH} / ${HERO_HEIGHT}` } as React.CSSProperties}
      tabIndex={many ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(current + 1, 1);
        if (e.key === "ArrowLeft") goTo(current - 1, -1);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) {
          if (dx < 0) goTo(current + 1, 1);
          else goTo(current - 1, -1);
        }
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      {slides.map((s, i) => {
        const active = i === current;
        const shown = active || i === leaving;
        const lines = s.heading?.split("\n") ?? [];
        return (
          <div
            key={s.src + i}
            id={`hero-slide-${i}`}
            data-slide={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={!active}
            // Stacked; non-visible slides stay mounted (visibility hidden) so their images stay loaded.
            className={cn("absolute inset-0", active ? "z-20" : i === leaving ? "z-10" : "z-0")}
            style={{ visibility: shown ? "visible" : "hidden" }}
          >
            <Link href={s.href} aria-label={s.alt} tabIndex={active ? 0 : -1} className="block size-full" draggable={false}>
              <picture>
                {s.mobileSrc && <source media="(max-width: 767px)" srcSet={cldUrl(s.mobileSrc, 900)} />}
                <SmartImage
                  src={s.src}
                  alt={s.alt}
                  width={HERO_WIDTH}
                  height={HERO_HEIGHT}
                  // No `priority`/`preload` here: it would preload the DESKTOP file even on phones, which
                  // pick the <source> above. fetchPriority + eager lets the browser fetch the right one first.
                  fetchPriority={i === 0 ? "high" : "low"}
                  loading={i === 0 ? "eager" : "lazy"}
                  sizes="100vw"
                  draggable={false}
                  className="size-full object-cover select-none"
                />
              </picture>
            </Link>

            {(lines.length > 0 || s.subheading || s.ctas?.length) && (
              <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/45 via-black/10 to-transparent md:items-center md:bg-gradient-to-r md:from-black/45 md:via-black/15">
                <div className="pointer-events-auto w-full max-w-[1360px] px-5 pb-16 md:mx-auto md:px-12 md:pb-0">
                  {lines.length > 0 && (
                    <h2 className="text-[34px] leading-[1.05] font-bold text-white md:text-6xl">
                      {lines.map((l, n) => (
                        <span key={n} className="block overflow-hidden pb-[0.08em]">
                          <span data-hero-text="" className="block">
                            {l}
                          </span>
                        </span>
                      ))}
                    </h2>
                  )}
                  {s.subheading && (
                    <span className="mt-3 block overflow-hidden">
                      <span data-hero-text="" className="block max-w-md text-base text-white/85 md:text-lg">
                        {s.subheading}
                      </span>
                    </span>
                  )}
                  {s.ctas?.length ? (
                    <span className="mt-6 block overflow-hidden pb-1">
                      <span data-hero-text="" className="flex flex-wrap gap-3">
                        {s.ctas.map((c, n) => (
                          <Link
                            key={c.href + n}
                            href={c.href}
                            tabIndex={active ? 0 : -1}
                            className={cn(
                              "inline-flex h-12 items-center rounded-full px-7 text-sm font-bold tracking-wide uppercase transition-colors",
                              n === 0 ? "bg-mustard text-forest-deep hover:bg-[#e8c879]" : "border border-white/70 text-white hover:bg-white/10",
                            )}
                          >
                            {c.label}
                          </Link>
                        ))}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {many && (
        <nav aria-label="Slides" className="absolute bottom-[23px] left-1/2 z-30 flex -translate-x-1/2 items-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
          {slides.map((s, i) => (
            <button
              key={s.src + i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-controls={`hero-slide-${i}`}
              aria-current={i === current}
              // 64px wide, 36px tall hit area; 2px track with the fill on top.
              className="group/bar relative h-9 w-16 px-1.5 before:absolute before:inset-x-1.5 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-white/50 before:content-['']"
            >
              <span className="absolute inset-x-1.5 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden">
                {i === current ? (
                  <BarFill key={`${current}-${run.id}`} playing={playing} onDone={() => goTo(current + 1, 1)} />
                ) : (
                  <span className="block size-full origin-left scale-x-0 bg-white" />
                )}
              </span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

/**
 * Active progress fill: scaleX 0 → 1 over the autoplay time, run with the Web Animations API (no
 * stylesheet needed). Pauses/resumes in place; when it finishes the slideshow advances, so the bar
 * and the slide can never drift apart.
 */
function BarFill({ playing, onDone }: { playing: boolean; onDone: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const anim = useRef<Animation | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = el.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: AUTOPLAY_S * 1000, easing: "linear", fill: "forwards" });
    a.onfinish = () => done.current();
    anim.current = a;
    return () => a.cancel();
  }, []);

  useEffect(() => {
    const a = anim.current;
    if (!a || a.playState === "finished") return;
    if (playing) a.play();
    else a.pause();
  }, [playing]);

  return <span ref={ref} className="block size-full origin-left scale-x-0 bg-white" />;
}
