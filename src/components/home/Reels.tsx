"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { cldVideo, cldVideoPoster } from "@/lib/image-loader";

export type ReelItem = {
  id: number;
  videoUrl: string;
  caption: string;
  product: { handle: string; title: string } | null;
  instagramUrl: string | null;
};

/** Muted preview that only plays while on screen (saves data + CPU). */
function Preview({ reel, onOpen }: { reel: ReelItem; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? void v.play().catch(() => {}) : v.pause()),
      { threshold: 0.6 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-[9/16] w-full overflow-hidden rounded-3xl bg-forest-deep text-left ring-1 ring-black/5 transition-shadow duration-500 hover:shadow-[0_24px_40px_-24px_rgba(7,47,27,0.7)]"
      aria-label={reel.caption ? `Play: ${reel.caption}` : "Play video"}
    >
      <video
        ref={ref}
        src={cldVideo(reel.videoUrl, 480)}
        poster={cldVideoPoster(reel.videoUrl, 480)}
        muted
        loop
        playsInline
        preload="none"
        className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
        {reel.caption && <span className="line-clamp-2 text-sm font-semibold text-white">{reel.caption}</span>}
      </span>
      <span className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-md transition-transform group-hover:scale-110" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}

export function Reels({ title, reels }: { title: string; reels: ReelItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const reel = open === null ? null : reels[open];

  useEffect(() => {
    if (open === null) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : Math.min(i + 1, reels.length - 1)));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, reels.length]);

  return (
    <section className="paper-grain relative overflow-hidden bg-[#F5EDDE] py-12 md:py-16">
      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-mustard/70" />
              <span className="relative size-2 rounded-full bg-mustard" />
            </span>
            Reels
          </p>
          <h2 className="text-3xl md:text-[44px]">{title}</h2>
          <p className="text-ink-muted">Real moments from our ghani. Tap to watch.</p>
        </div>
        <ul className={`no-scrollbar mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:mt-8 md:gap-4 ${reels.length <= 5 ? "lg:justify-center" : ""}`}>
          {reels.map((r, i) => (
            <li key={r.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[18.5%]">
              <Preview reel={r} onOpen={() => setOpen(i)} />
              {r.product && (
                <Link href={`/products/${r.product.handle}`} className="mt-2 block truncate text-sm font-semibold text-forest-text hover:underline">
                  {r.product.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>

      {reel && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Video" onClick={() => setOpen(null)}>
          <div className="relative w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            <video
              key={reel.id}
              src={cldVideo(reel.videoUrl, 1080)}
              poster={cldVideoPoster(reel.videoUrl, 720)}
              controls
              autoPlay
              playsInline
              className="aspect-[9/16] max-h-[80svh] w-full rounded-2xl bg-black object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-white">
              <p className="line-clamp-2 text-sm">{reel.caption}</p>
              <div className="flex shrink-0 gap-2">
                {reel.instagramUrl && (
                  <a href={reel.instagramUrl} target="_blank" rel="noreferrer" className="min-h-10 rounded-full border border-white/40 px-4 text-sm leading-10">
                    Instagram
                  </a>
                )}
                {reel.product && (
                  <Link href={`/products/${reel.product.handle}`} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold leading-10 text-forest">
                    Shop now
                  </Link>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(null)} className="absolute -top-12 right-0 grid size-10 place-items-center rounded-full bg-white/15 text-2xl text-white" aria-label="Close">
              ×
            </button>
            {open! > 0 && (
              <button type="button" onClick={() => setOpen(open! - 1)} className="absolute left-[-56px] top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white md:grid" aria-label="Previous video">
                ‹
              </button>
            )}
            {open! < reels.length - 1 && (
              <button type="button" onClick={() => setOpen(open! + 1)} className="absolute right-[-56px] top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white md:grid" aria-label="Next video">
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
