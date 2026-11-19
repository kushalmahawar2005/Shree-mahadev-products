"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2, Minus, Pause, Play, Plus, ShoppingBag, ShoppingCart, Volume2, VolumeX, X } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dialog, DialogDescription, DialogPortal, DialogTitle } from "@/components/shadcn/dialog";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/shadcn/carousel";
import { cldVideo, cldVideoPoster, thumbUrl } from "@/lib/image-loader";
import { ReelFrame } from "./ReelFrame";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { VideoTile } from "./VideoTile";

/**
 * One reel. Content comes from /admin/videos (or the fallback list in the home page), so the set
 * is easy to change: video, caption and the tagged product (with its sizes, for the viewer).
 */
export type ReelItem = {
  id: number;
  videoUrl: string;
  caption: string;
  product: {
    handle: string;
    title: string;
    image?: string;
    price?: number;
    variantId?: string;
    variantTitle?: string;
    variants?: { id: string; title: string; price: number }[];
  } | null;
  instagramUrl: string | null;
  /** Instagram / YouTube player URL: plays in an iframe instead of our <video>. */
  embedUrl?: string | null;
  /** Poster for linked reels (YouTube still, uploaded cover, or the product photo). */
  posterUrl?: string | null;
};

const posterOf = (r: ReelItem, w: number) => r.posterUrl || cldVideoPoster(r.videoUrl, w);

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Straight from the ghani" reels: 9:16 cards in an Embla carousel (desktop arrows + right fade,
 * phone snap with a peek). Cards share the compact overlay of the brand-film tiles and play on
 * hover (desktop) or when mostly in view (touch). A card opens the full-screen reel viewer.
 */
export function Reels({
  title,
  reels,
  align = "center",
  dark = false,
  hideOnMobile = false,
  eyebrow = "घाणी से सीधा",
  subtitle = "Real moments from our ghani. Tap any reel to watch.",
}: {
  title: string;
  reels: ReelItem[];
  /** "left": product-page variant (left-aligned header, PDP container, no paper texture). */
  align?: "center" | "left";
  /** Light text for a dark (forest) band behind the section. */
  dark?: boolean;
  /** Hide the whole section on phones (home: phones get <ReelStories> above the hero instead). */
  hideOnMobile?: boolean;
  eyebrow?: string;
  subtitle?: string;
}) {
  const left = align === "left";
  const [open, setOpenRaw] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const setOpen = (i: number | null) => {
    setOpenRaw(i);
    if (i !== null) setSeen((s) => new Set(s).add(reels[i]?.id ?? -999));
  };
  const [api, setApi] = useState<CarouselApi>();
  const [edge, setEdge] = useState({ prev: false, next: false });

  useEffect(() => {
    if (!api) return;
    const update = () => setEdge({ prev: api.canScrollPrev(), next: api.canScrollNext() });
    update();
    api.on("select", update).on("reInit", update);
    return () => {
      api.off("select", update).off("reInit", update);
    };
  }, [api]);

  const arrow =
    "grid size-11 place-items-center rounded-full border border-line bg-white/90 text-forest-text shadow-[0_10px_24px_-12px_rgba(7,47,27,0.45)] transition-[opacity,transform] duration-300 hover:scale-105 disabled:pointer-events-none disabled:opacity-35";

  return (
    <LayoutGroup id="reels">
      <section className={cn("relative overflow-hidden", hideOnMobile && "hidden md:block", left ? "py-12 md:py-16" : "paper-grain bg-page pt-14 pb-14 md:pt-20 md:pb-20")}>
        <div className={cn("relative mx-auto", left ? "max-w-7xl px-6 md:px-8" : "max-w-[1360px] px-4 md:px-8")}>
          <div className={cn("relative flex flex-col", left ? "items-start text-left md:pr-28" : "items-center text-center")}>
            <p className={cn("font-hindi flex items-center gap-2 text-base md:text-lg", dark ? "text-co-gold" : left ? "text-co-accent-ink" : "text-sale")} lang="hi">
              {!left && <span aria-hidden className="h-px w-6 bg-sale/50" />}
              {eyebrow}
              {!left && <span aria-hidden className="h-px w-6 bg-sale/50" />}
            </p>
            <h2 className={cn("mt-1 leading-[1.1] tracking-tight", left ? cn("text-[26px] tracking-[-0.02em] md:text-[34px]", dark ? "text-white" : "text-ink") : "mt-2 text-[30px] font-bold md:text-[44px]")}>{title}</h2>
            <p className={cn("mt-2 max-w-xl text-[15px] md:text-base", dark ? "text-white/70" : "text-ink-muted")}>{subtitle}</p>
            {/* Arrows: top-right of the section (desktop), only when the row can scroll */}
            {(edge.prev || edge.next) && (
              <div className="absolute right-0 bottom-0 hidden gap-2 lg:flex">
                <button type="button" aria-label="Previous reels" disabled={!edge.prev} onClick={() => api?.scrollPrev()} className={arrow}>
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" aria-label="More reels" disabled={!edge.next} onClick={() => api?.scrollNext()} className={arrow}>
                  <ChevronRight className="size-5" />
                </button>
              </div>
            )}
          </div>

          {/* Phones: Instagram-style story circles; tap opens the same full-screen viewer. */}
          <StoryRow reels={reels} dark={dark} onOpen={setOpen} seen={seen} />

          <Carousel
            setApi={setApi}
            opts={{ align: "start", containScroll: "trimSnaps" }}
            // No edge fade (owner: plain cut-off card reads better than a blurred edge)
            className="-mx-4 mt-8 hidden px-4 md:mx-0 md:mt-10 md:block md:px-0"
          >
            {/* A short list (fits on screen) sits centred on desktop instead of hugging the left */}
            <CarouselContent className={cn("-ml-3 md:-ml-5", !edge.prev && !edge.next && "md:justify-center")}>
              {reels.map((r, i) => (
                <CarouselItem key={r.id} className="basis-[70vw] pl-3 sm:basis-[42vw] md:basis-[280px] md:pl-5">
                  {/* Always rendered visible (no scroll-triggered fade), so the row is never blank */}
                  <motion.div layoutId={`reel-${r.id}`} className="aspect-[9/16]">
                    <VideoTile
                      src={r.embedUrl ? undefined : cldVideo(r.videoUrl, 480)}
                      poster={posterOf(r, 480)}
                      title={r.caption || "From our ghani"}
                      // Tagged reels get the shop card below instead of the glass chip on the video.
                      product={r.product ? undefined : { href: "/collections/wood-pressed-oils", title: "Shop wood-pressed oils" }}
                      footer={r.product ? <ReelShopCard product={r.product} /> : undefined}
                      compact
                      playOnHover
                      onOpen={() => setOpen(i)}
                      className="size-full"
                    />
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        <ReelViewer reels={reels} start={open} onClose={() => setOpen(null)} />
      </section>
    </LayoutGroup>
  );
}

/** Phones only: the reels as a story strip at the very top of the page (above the hero). */
export function ReelStories({ reels }: { reels: ReelItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  if (!reels.length) return null;
  return (
    <div className="border-b border-line bg-page px-4 pt-3 pb-2 md:hidden">
      <StoryRow
        reels={reels}
        dark={false}
        seen={seen}
        flush
        onOpen={(i) => {
          setOpen(i);
          setSeen((s) => new Set(s).add(reels[i]?.id ?? -999));
        }}
      />
      <ReelViewer reels={reels} start={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Story circles (phones only): gradient ring until watched, short label under each. */
function StoryRow({
  reels,
  dark,
  onOpen,
  seen,
  flush = false,
}: {
  reels: ReelItem[];
  dark: boolean;
  onOpen: (i: number) => void;
  seen: Set<number>;
  /** No top margin (used as the page-top strip). */
  flush?: boolean;
}) {
  const oneProduct = new Set(reels.map((r) => r.product?.handle)).size === 1;
  return (
    <ul className={cn("no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 md:hidden", !flush && "mt-6")}>
      {reels.map((r, i) => {
        const watched = seen.has(r.id);
        // Every reel on one product (PDP): name the clip, not the product, so the circles differ.
        const label = r.product && !oneProduct ? shortTitle(r.product.title).replace(/\s+Oil$/, "") : r.caption || "Our ghani";
        return (
          <li key={r.id} className="shrink-0">
            <button type="button" onClick={() => onOpen(i)} className="flex w-[76px] flex-col items-center gap-1.5" aria-label={`Watch: ${r.caption || label}`}>
              <span
                className={cn(
                  "rounded-full p-[2.5px] transition-opacity",
                  watched ? (dark ? "bg-white/25" : "bg-line") : "bg-[conic-gradient(from_200deg,#E8C879,#C9952B,#F3C64A,#1F7A45,#E8C879)]",
                )}
              >
                <span className={cn("block rounded-full p-[2.5px]", dark ? "bg-[#0E3B26]" : "bg-page")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- small video poster frame from Cloudinary */}
                  <img src={posterOf(r, 160)} alt="" loading="lazy" className="size-[66px] rounded-full object-cover" />
                </span>
              </span>
              <span className={cn("w-full truncate text-center text-[11px] font-medium", dark ? "text-white/85" : "text-ink")}>{label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Full-screen story viewer (shadcn Dialog), Instagram-style: one progress bar per story, tap the
 * right side for next / left side for previous, hold to pause, swipe left/right, auto-advance and
 * close after the last one. Arrow keys / side arrows on desktop. Product card with a size picker +
 * add to cart that turns into a − qty + stepper (the cart shows its own toast).
 */
export function ReelViewer({ reels, start, onClose }: { reels: ReelItem[]; start: number | null; onClose: () => void }) {
  const open = start !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && (
        // Radix content directly (not shadcn DialogContent, whose centred-modal classes fight a
        // full-screen layout): it covers the whole viewport, with focus trap + Escape from Radix.
        <DialogPortal>
          <DialogPrimitive.Content
            className="fixed inset-0 z-[90] flex h-dvh w-screen items-center justify-center bg-black/95 outline-none"
            data-lenis-prevent=""
          >
            <DialogTitle className="sr-only">Reels</DialogTitle>
            <DialogDescription className="sr-only">Tap the right or left side, swipe, or use the arrow keys to move between stories. Hold to pause.</DialogDescription>
            <ViewerBody key={start} reels={reels} start={start} onClose={onClose} />
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </Dialog>
  );
}

function ViewerBody({ reels, start, onClose }: { reels: ReelItem[]; start: number; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(start);
  const [dir, setDir] = useState(1);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const reel = reels[i];

  const go = (d: 1 | -1) => {
    const n = i + d;
    // Past the last story closes the viewer (like Instagram); before the first does nothing.
    if (n >= reels.length) return onClose();
    if (n < 0) return;
    setDir(d);
    setI(n);
    setProgress(0);
    setPaused(false);
  };

  // Stop the page (Lenis) scrolling underneath while the viewer is open.
  useEffect(() => {
    lockScroll();
    return () => unlockScroll();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") go(1);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go reads the current index each render
  }, [i]);

  // Tap = next/previous by side; press and hold = pause until released.
  const press = useRef<{ x: number; y: number; t: number; held: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const p = { x: e.clientX, y: e.clientY, t: Date.now(), held: false } as NonNullable<typeof press.current>;
    p.timer = setTimeout(() => {
      p.held = true;
      video.current?.pause();
      setPaused(true);
    }, 220);
    press.current = p;
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.held) {
      void video.current?.play();
      setPaused(false);
      return;
    }
    if (Math.abs(e.clientX - p.x) > 12 || Math.abs(e.clientY - p.y) > 12) return; // a swipe, not a tap
    const box = e.currentTarget.getBoundingClientRect();
    go(e.clientX - box.left < box.width / 3 ? -1 : 1);
  };

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  const side = "hidden size-12 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 disabled:opacity-30 sm:grid";

  return (
    <div className="flex h-full w-full items-center justify-center gap-6 sm:p-6" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <button type="button" aria-label="Previous story" disabled={i === 0} onClick={() => go(-1)} className={side}>
        <ChevronLeft className="size-5" />
      </button>

      <motion.div
        layoutId={i === start ? `reel-${reel.id}` : undefined}
        transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
        // Phone: the whole screen. sm+: a centred 9:16 player.
        className="relative h-full w-full overflow-hidden bg-black sm:aspect-[9/16] sm:h-[min(88dvh,820px)] sm:w-auto sm:rounded-3xl"
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={reel.id}
            custom={dir}
            initial={reduce ? false : { x: `${dir * 100}%` }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: `${dir * -100}%` }}
            transition={{ duration: 0.35, ease: EASE }}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70) go(1);
              else if (info.offset.x > 70) go(-1);
              else if (info.offset.y > 120) onClose(); // pull down to close
            }}
            className="absolute inset-0"
          >
            {reel.embedUrl ? (
              <ReelFrame src={reel.embedUrl} title={reel.caption || "Reel"} className="top-16 bottom-40" />
            ) : (
            <video
              ref={video}
              src={cldVideo(reel.videoUrl, 1080)}
              poster={cldVideoPoster(reel.videoUrl, 720)}
              autoPlay
              muted={muted}
              playsInline
              preload="metadata"
              disablePictureInPicture
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
              onEnded={() => go(1)}
              className="absolute inset-0 size-full object-cover"
            />
            )}
            {/* Tap left third: previous · tap elsewhere: next · hold: pause (own videos only: an embed needs its own taps) */}
            {!reel.embedUrl && (
            <div
              role="presentation"
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerCancel={() => {
                if (press.current) clearTimeout(press.current.timer);
                press.current = null;
              }}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 cursor-pointer touch-pan-y select-none [-webkit-touch-callout:none]"
            />
            )}
            <AnimatePresence>
              {paused && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="pointer-events-none absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md"
                >
                  <Play className="ml-1 size-7 fill-white" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        {/* One bar per story: done = full, current = real playback progress, upcoming = empty */}
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {reels.map((r, n) => (
            <span key={r.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full origin-left rounded-full bg-white" style={{ transform: `scaleX(${n < i ? 1 : n === i ? progress : 0})` }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-3 top-6 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
            <span className="grid size-7 place-items-center rounded-full bg-co-gold text-[10px] font-bold text-forest-deep">SM</span>
            Mahadev Products
            <span className="text-white/60 tabular-nums">
              {i + 1}/{reels.length}
            </span>
          </span>
          <span className="flex gap-1.5">
            {!reel.embedUrl && (
            <button type="button" onClick={togglePlay} className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label={paused ? "Play" : "Pause"}>
              {paused ? <Play className="ml-0.5 size-4 fill-white" /> : <Pause className="size-4 fill-white" />}
            </button>
            )}
            {!reel.embedUrl && (
            <button type="button" onClick={() => setMuted((m) => !m)} className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            )}
            <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="Close">
              <X className="size-4" />
            </button>
          </span>
        </div>

        <div className="absolute inset-x-3 bottom-4 space-y-3">
          {reel.caption && <p className="px-1 text-base leading-snug font-semibold text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">{reel.caption}</p>}
          {reel.product && <ViewerProduct key={reel.id} product={reel.product} />}
          {reel.instagramUrl && (
            <a href={reel.instagramUrl} target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold text-white/80 underline-offset-2 hover:underline">
              Watch on Instagram
            </a>
          )}
          {/* phone hint */}
          {reels.length > 1 && <p className="text-center text-[11px] text-white/60 sm:hidden">Tap to skip · Hold to pause</p>}
        </div>
      </motion.div>

      <button type="button" aria-label="Next story" disabled={i === reels.length - 1} onClick={() => go(1)} className={side}>
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}

/**
 * Slim shoppable strip under a reel card: photo, name + price (both link to the product) and a
 * small one-tap Add (default size) that turns into a stepper once it is in the cart.
 */
function ReelShopCard({ product }: { product: NonNullable<ReelItem["product"]> }) {
  const { cart, add, update } = useCart();
  const [busy, setBusy] = useState(false);
  const variantId = product.variantId ?? product.variants?.[0]?.id;
  const price = product.variants?.find((v) => v.id === variantId)?.price ?? product.price;
  const line = cart?.lines.find((l) => l.variant.id === variantId);
  const href = `/products/${product.handle}`;
  const title = shortTitle(product.title);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    // Glass strip inside the video's bottom edge (same glass as the play button), white text.
    <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 p-1.5 pr-1.5 text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <Link href={href} tabIndex={-1} aria-hidden className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-khaki-soft">
        {product.image ? (
          <Image src={thumbUrl(product.image, 36)} alt="" width={36} height={36} unoptimized className="size-8 object-contain" />
        ) : (
          <ShoppingBag className="size-4 text-forest" />
        )}
      </Link>
      <Link href={href} className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-semibold [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">{title}</span>
        {price ? <span className="block text-xs text-white/80 tabular-nums">{formatMoney(price)}</span> : null}
      </Link>
      {variantId &&
        (line ? (
          <div className="flex h-8 shrink-0 items-center rounded-full bg-co-gold text-forest-deep" aria-label={`${line.quantity} in cart`}>
            <button type="button" disabled={busy} onClick={() => run(() => update(line.id, line.quantity - 1))} className="grid size-8 place-items-center disabled:opacity-60" aria-label="Remove one">
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-4 text-center text-xs font-semibold tabular-nums">{busy ? <Loader2 className="size-3.5 animate-spin" /> : line.quantity}</span>
            <button type="button" disabled={busy} onClick={() => run(() => update(line.id, line.quantity + 1))} className="grid size-8 place-items-center disabled:opacity-60" aria-label="Add one more">
              <Plus className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => add(variantId))}
            aria-label={`Add ${title} to cart`}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-co-gold px-3 text-xs font-semibold text-forest-deep transition-colors hover:bg-white disabled:opacity-70"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShoppingCart className="size-3.5" />} Add
          </button>
        ))}
    </div>
  );
}

/** Product card inside the viewer: size picker, add to cart → stepper, and a link to the product. */
function ViewerProduct({ product }: { product: NonNullable<ReelItem["product"]> }) {
  const { cart, add, update } = useCart();
  const sizes = product.variants?.length
    ? product.variants
    : product.variantId
      ? [{ id: product.variantId, title: product.variantTitle ?? "", price: product.price ?? 0 }]
      : [];
  const [sizeId, setSizeId] = useState(product.variantId ?? sizes[0]?.id);
  const [busy, setBusy] = useState(false);
  const size = sizes.find((s) => s.id === sizeId) ?? sizes[0];
  const line = cart?.lines.find((l) => l.variant.id === size?.id);
  const href = `/products/${product.handle}`;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5 rounded-2xl border border-white/15 bg-black/40 p-2.5 text-white backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-khaki-soft">
          {product.image ? <Image src={thumbUrl(product.image, 48)} alt="" width={48} height={48} unoptimized className="size-11 object-contain" /> : <ShoppingBag className="size-5 text-forest" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{shortTitle(product.title)}</p>
          {size && <p className="text-xs text-white/75 tabular-nums">{formatMoney(size.price)}</p>}
        </div>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white/85 underline-offset-2 hover:underline">
          View product <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {sizes.length > 1 && (
        <div role="radiogroup" aria-label="Size" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {sizes.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === size?.id}
              onClick={() => setSizeId(s.id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors",
                s.id === size?.id ? "border-co-gold bg-co-gold font-semibold text-forest-deep" : "border-white/25 text-white hover:border-white/60",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {size &&
        (line ? (
          <motion.div layout className="flex h-11 items-center gap-1 rounded-full bg-co-gold p-1 text-forest-deep" aria-label={`${line.quantity} in cart`}>
            <button type="button" disabled={busy} onClick={() => run(() => update(line.id, line.quantity - 1))} className="grid size-9 place-items-center rounded-full bg-black/10 disabled:opacity-60" aria-label="Remove one">
              <Minus className="size-4" />
            </button>
            <span className="flex flex-1 justify-center text-sm font-bold tabular-nums">{busy ? <Loader2 className="size-4 animate-spin" /> : `${line.quantity} in cart`}</span>
            <button type="button" disabled={busy} onClick={() => run(() => update(line.id, line.quantity + 1))} className="grid size-9 place-items-center rounded-full bg-black/10 disabled:opacity-60" aria-label="Add one more">
              <Plus className="size-4" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            layout
            type="button"
            disabled={busy}
            onClick={() => run(() => add(size.id))}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-co-gold text-sm font-medium text-forest-deep transition-colors hover:bg-white disabled:opacity-70"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />} Add to cart
          </motion.button>
        ))}
    </div>
  );
}
