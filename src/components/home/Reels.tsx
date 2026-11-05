"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowUpRight, Check, Loader2, Play, ShoppingBag, Volume2, VolumeX, X } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { cldVideo, cldVideoPoster } from "@/lib/image-loader";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type ReelItem = {
  id: number;
  videoUrl: string;
  caption: string;
  product: { handle: string; title: string; image?: string; price?: number; variantId?: string; variantTitle?: string } | null;
  instagramUrl: string | null;
};

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/** Reel card: 3D tilt + moving sheen (Aceternity-style), plays muted while on screen, progress line, shoppable glass bar. */
function ReelCard({ reel, onOpen, index }: { reel: ReelItem; onOpen: () => void; index: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const sheen = useMotionTemplate`radial-gradient(400px circle at ${gx}% ${gy}%, rgba(255,255,255,0.22), transparent 45%)`;

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? void v.play().catch(() => {}) : v.pause()), { threshold: 0.5 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <motion.div
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * 12);
        rx.set((0.5 - py) * 12);
        gx.set(px * 100);
        gy.set(py * 100);
      }}
      onMouseLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      className={cn("group relative", index % 2 === 1 && "md:translate-y-8")}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[9/16] w-full overflow-hidden rounded-[28px] bg-forest-deep text-left shadow-[0_30px_50px_-30px_rgba(7,47,27,0.65)] ring-1 ring-black/5"
        aria-label={reel.caption ? `Watch: ${reel.caption}` : "Watch video"}
      >
        <video
          ref={ref}
          src={cldVideo(reel.videoUrl, 480)}
          poster={cldVideoPoster(reel.videoUrl, 480)}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
        />
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: sheen }} />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/25" />

        {/* progress line */}
        <span aria-hidden className="absolute inset-x-4 top-3.5 h-[3px] overflow-hidden rounded-full bg-white/25">
          <span className="block h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
        </span>
        <span aria-hidden className="absolute top-7 right-3.5 grid size-8 place-items-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-md">
          <Play className="ml-0.5 size-3.5 fill-white text-white" />
        </span>

        <span className="absolute inset-x-3 bottom-3 space-y-2">
          {reel.caption && <span className="line-clamp-2 px-1 text-[13px] leading-snug font-semibold text-white drop-shadow">{reel.caption}</span>}
          {reel.product && (
            <span className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 p-1.5 pr-2.5 backdrop-blur-md">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f6efe2]">
                {reel.product.image ? <Image src={reel.product.image} alt="" width={36} height={36} className="size-8 object-contain" /> : <ShoppingBag className="size-4 text-forest" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white">{shortTitle(reel.product.title)}</span>
                {reel.product.price ? <span className="block text-[11px] text-white/75">{formatMoney(reel.product.price)}</span> : null}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-white" />
            </span>
          )}
        </span>
      </button>
    </motion.div>
  );
}

/** Story-style viewer: progress segments, auto-advance, tap/swipe/keys, sound toggle, add-to-cart. */
function Viewer({ reels, start, onClose }: { reels: ReelItem[]; start: number; onClose: () => void }) {
  const { add } = useCart();
  const [i, setI] = useState(start);
  const [p, setP] = useState(0);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const reel = reels[i];
  const go = (d: number) => {
    const n = i + d;
    if (n < 0) return;
    if (n >= reels.length) return onClose();
    setI(n);
    setP(0);
    setAdded(false);
  };

  useEffect(() => {
    lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go reads latest index via closure per render
  }, [i]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-0 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Reels"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="relative h-full w-full overflow-hidden bg-black sm:h-[min(88svh,780px)] sm:w-auto sm:rounded-[28px]"
        style={{ aspectRatio: "9 / 16" }}
        onClick={(e) => e.stopPropagation()}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70) go(1);
          else if (info.offset.x > 70) go(-1);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.video
            key={reel.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            src={cldVideo(reel.videoUrl, 1080)}
            poster={cldVideoPoster(reel.videoUrl, 720)}
            autoPlay
            muted={muted}
            playsInline
            disablePictureInPicture
            onTimeUpdate={(e) => setP(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
            onEnded={() => go(1)}
            className="absolute inset-0 size-full object-cover"
          />
        </AnimatePresence>
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

        {/* tap zones */}
        <button type="button" aria-label="Previous reel" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3" />
        <button type="button" aria-label="Next reel" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-1/3" />

        {/* progress segments + top bar */}
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {reels.map((r, n) => (
            <span key={r.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full bg-white" style={{ width: `${n < i ? 100 : n === i ? p * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-3 top-6 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
            <span className="grid size-7 place-items-center rounded-full bg-[#e8c879] text-[10px] font-bold text-forest-deep">SM</span>
            Mahadev Products
          </span>
          <span className="flex gap-1.5">
            <button type="button" onClick={() => setMuted((m) => !m)} className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="Close">
              <X className="size-4" />
            </button>
          </span>
        </div>

        {/* caption + product */}
        <div className="absolute inset-x-3 bottom-4 space-y-3">
          {reel.caption && <p className="px-1 text-base leading-snug font-semibold text-white">{reel.caption}</p>}
          {reel.product && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/15 p-2 backdrop-blur-md">
              <Link href={`/products/${reel.product.handle}`} className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f6efe2]">
                {reel.product.image ? <Image src={reel.product.image} alt="" width={48} height={48} className="size-11 object-contain" /> : <ShoppingBag className="size-5 text-forest" />}
              </Link>
              <Link href={`/products/${reel.product.handle}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{shortTitle(reel.product.title)}</span>
                {reel.product.price ? (
                  <span className="block text-xs text-white/75">
                    {formatMoney(reel.product.price)}
                    {reel.product.variantTitle ? ` · ${reel.product.variantTitle}` : ""}
                  </span>
                ) : null}
              </Link>
              {reel.product.variantId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await add(reel.product!.variantId!);
                      setAdded(true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#e8c879] px-4 text-xs font-bold text-forest-deep disabled:opacity-70"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
                  {added ? "Added" : "Add"}
                </button>
              ) : (
                <Link href={`/products/${reel.product.handle}`} className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#e8c879] px-4 text-xs font-bold text-forest-deep">
                  Shop
                </Link>
              )}
            </div>
          )}
          {reel.instagramUrl && (
            <a href={reel.instagramUrl} target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold text-white/80 underline-offset-2 hover:underline">
              Watch on Instagram
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Reels({ title, reels }: { title: string; reels: ReelItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const reduce = useReducedMotion();

  return (
    <section className="paper-grain relative overflow-hidden bg-[#F5EDDE] py-12 md:pt-16 md:pb-24">
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
          <p className="text-ink-muted">Real moments from our ghani. Tap any reel to watch.</p>
        </div>
        <ul className={cn("no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pt-2 pb-10 md:mt-10 md:gap-5", reels.length <= 5 && "lg:justify-center")}>
          {reels.map((r, i) => (
            <motion.li
              key={r.id}
              className="w-[58%] shrink-0 snap-center sm:w-[36%] md:w-[25%] lg:w-[21%]"
              initial={reduce ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <ReelCard reel={r} index={i} onOpen={() => setOpen(i)} />
            </motion.li>
          ))}
        </ul>
      </div>

      <AnimatePresence>{open !== null && <Viewer key="viewer" reels={reels} start={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </section>
  );
}
