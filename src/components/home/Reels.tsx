"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Minus, Pause, Play, Plus, ShoppingBag, ShoppingCart, Volume2, VolumeX, X } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dialog, DialogDescription, DialogPortal, DialogTitle } from "@/components/shadcn/dialog";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/shadcn/carousel";
import { cldVideo, cldVideoPoster, thumbUrl } from "@/lib/image-loader";
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
};

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Straight from the ghani" reels: 9:16 cards in an Embla carousel (desktop arrows + right fade,
 * phone snap with a peek). Cards share the compact overlay of the brand-film tiles and play on
 * hover (desktop) or when mostly in view (touch). A card opens the full-screen reel viewer.
 */
export function Reels({ title, reels }: { title: string; reels: ReelItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
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
      <section className="paper-grain relative overflow-hidden bg-page pt-14 pb-14 md:pt-20 md:pb-20">
        <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
          <div className="relative flex flex-col items-center text-center">
            <p className="font-hindi flex items-center gap-2 text-base text-sale md:text-lg" lang="hi">
              <span aria-hidden className="h-px w-6 bg-sale/50" />
              घानी से सीधा
              <span aria-hidden className="h-px w-6 bg-sale/50" />
            </p>
            <h2 className="mt-2 text-[30px] leading-[1.1] font-bold tracking-tight md:text-[44px]">{title}</h2>
            <p className="mt-3 max-w-xl text-[15px] text-ink-muted md:text-base">Real moments from our ghani. Tap any reel to watch.</p>
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

          <Carousel
            setApi={setApi}
            opts={{ align: "start", containScroll: "trimSnaps" }}
            // No edge fade (owner: plain cut-off card reads better than a blurred edge)
            className="-mx-4 mt-8 px-4 md:mx-0 md:mt-10 md:px-0"
          >
            {/* A short list (fits on screen) sits centred on desktop instead of hugging the left */}
            <CarouselContent className={cn("-ml-3 md:-ml-5", !edge.prev && !edge.next && "md:justify-center")}>
              {reels.map((r, i) => (
                <CarouselItem key={r.id} className="basis-[70vw] pl-3 sm:basis-[42vw] md:basis-[280px] md:pl-5">
                  {/* Always rendered visible (no scroll-triggered fade), so the row is never blank */}
                  <motion.div layoutId={`reel-${r.id}`} className="aspect-[9/16]">
                    <VideoTile
                      src={cldVideo(r.videoUrl, 480)}
                      poster={cldVideoPoster(r.videoUrl, 480)}
                      title={r.caption || "From our ghani"}
                      product={
                        r.product
                          ? { href: `/products/${r.product.handle}`, title: shortTitle(r.product.title), image: r.product.image, price: r.product.price }
                          : { href: "/collections/wood-pressed-oils", title: "Shop wood-pressed oils" }
                      }
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

/**
 * Full-screen reel viewer (shadcn Dialog): sound on, tap to pause, real progress bar, swipe
 * up/down (phone) or arrow keys / side arrows (desktop) between reels, and a product card with a
 * size picker + add to cart that turns into a − qty + stepper (the cart shows its own toast).
 */
function ReelViewer({ reels, start, onClose }: { reels: ReelItem[]; start: number | null; onClose: () => void }) {
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
            <DialogDescription className="sr-only">Swipe up or down, or use the arrow keys, to move between reels.</DialogDescription>
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
    if (n < 0 || n >= reels.length) return;
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
      <button type="button" aria-label="Previous reel" disabled={i === 0} onClick={() => go(-1)} className={side}>
        <ChevronUp className="size-5" />
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
            initial={reduce ? false : { y: `${dir * 100}%` }}
            animate={{ y: 0 }}
            exit={reduce ? undefined : { y: `${dir * -100}%` }}
            transition={{ duration: 0.35, ease: EASE }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.y < -80) go(1);
              else if (info.offset.y > 80) go(-1);
            }}
            className="absolute inset-0"
          >
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
              onEnded={() => (i < reels.length - 1 ? go(1) : setPaused(true))}
              className="absolute inset-0 size-full object-cover"
            />
            {/* tap anywhere on the video: pause / play */}
            <button type="button" aria-label={paused ? "Play" : "Pause"} onClick={togglePlay} className="absolute inset-0 cursor-pointer" />
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

        {/* real playback progress */}
        <div className="absolute inset-x-3 top-3 h-[3px] overflow-hidden rounded-full bg-white/25">
          <span className="block h-full origin-left rounded-full bg-white" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <div className="absolute inset-x-3 top-6 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
            <span className="grid size-7 place-items-center rounded-full bg-[#e8c879] text-[10px] font-bold text-forest-deep">SM</span>
            Mahadev Products
            <span className="text-white/60 tabular-nums">
              {i + 1}/{reels.length}
            </span>
          </span>
          <span className="flex gap-1.5">
            <button type="button" onClick={togglePlay} className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label={paused ? "Play" : "Pause"}>
              {paused ? <Play className="ml-0.5 size-4 fill-white" /> : <Pause className="size-4 fill-white" />}
            </button>
            <button type="button" onClick={() => setMuted((m) => !m)} className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
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
          {reels.length > 1 && (
            <p className="flex items-center justify-center gap-1 text-[11px] text-white/60 sm:hidden">
              <ChevronUp className="size-3" /> Swipe for more
            </p>
          )}
        </div>
      </motion.div>

      <button type="button" aria-label="Next reel" disabled={i === reels.length - 1} onClick={() => go(1)} className={side}>
        <ChevronDown className="size-5" />
      </button>
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
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f6efe2]">
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
                s.id === size?.id ? "border-[#e8c879] bg-[#e8c879] font-semibold text-forest-deep" : "border-white/25 text-white hover:border-white/60",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {size &&
        (line ? (
          <motion.div layout className="flex h-11 items-center gap-1 rounded-full bg-[#e8c879] p-1 text-forest-deep" aria-label={`${line.quantity} in cart`}>
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
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#e8c879] text-sm font-medium text-forest-deep transition-colors hover:bg-white disabled:opacity-70"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />} Add to cart
          </motion.button>
        ))}
    </div>
  );
}
