"use client";

import { showRating } from "@/lib/utils/reviews";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, Check, Loader2, ShoppingBag, Star } from "lucide-react";
import { Sparkles } from "@/components/icons/duo";
import { useCart } from "@/components/cart/CartProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { flyToCart } from "@/lib/fly-to-cart";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type SpotItem = {
  handle: string;
  title: string;
  titleHi: string;
  text: string;
  note: string;
  color: string;
  swatch: string;
  image?: { url: string; alt: string; width: number; height: number };
  /**
   * Lifestyle photo for this slide: fills the right side of the card (top on phones) and fades into
   * `bg`, which becomes the whole card's background (pick the photo's own backdrop colour so the edge
   * disappears). `position` is the CSS object-position that keeps the subject in frame.
   */
  photo?: { url: string; alt: string; bg: string; position?: string };
  rating?: number;
  reviewCount?: number;
  variant?: { id: string; title: string; price: number; mrp?: number };
};

const AUTOPLAY = 6000;

/** Featured product stage: big glowing bottle + story + add to cart, thumbnail rail with autoplay progress. */
export function SpotlightStage({ items }: { items: SpotItem[] }) {
  const { add } = useCart();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const s = items[i];

  useEffect(() => {
    if (hold || reduce || items.length < 2) return;
    const t = setTimeout(() => {
      setI((n) => (n + 1) % items.length);
      setAdded(false);
    }, AUTOPLAY);
    return () => clearTimeout(t);
  }, [i, hold, reduce, items.length]);

  if (!s) return null;
  const pick = (n: number) => {
    setI(n);
    setAdded(false);
  };

  return (
    <div onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocusCapture={() => setHold(true)} onBlurCapture={() => setHold(false)}>
      <div className="relative overflow-hidden rounded-3xl text-white md:rounded-[32px] shadow-[0_40px_80px_-50px_rgba(7,47,27,0.8)]">
        {/* colour mood crossfades per product */}
        <AnimatePresence initial={false}>
          <motion.div
            key={s.handle + "-bg"}
            className="absolute inset-0"
            style={{ background: s.photo ? s.photo.bg : `linear-gradient(135deg, ${s.color} 0%, ${s.color}e6 55%, #041d10 100%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        </AnimatePresence>
        {/* Lifestyle photo: right side on desktop (fades left into the card colour), top on phones. */}
        <AnimatePresence initial={false}>
          {s.photo && (
            <motion.div
              key={s.handle + "-photo"}
              className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/3] md:inset-y-0 md:right-0 md:left-auto md:aspect-auto md:w-[62%]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <SmartImage
                src={s.photo.url}
                alt={s.photo.alt}
                fill
                sizes="(min-width: 768px) 62vw, 100vw"
                className="object-cover [mask-image:linear-gradient(to_bottom,black_55%,transparent)] md:[mask-image:linear-gradient(to_right,transparent_0%,black_38%)]"
                style={{ objectPosition: s.photo.position ?? "70% center" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <span aria-hidden className="absolute inset-0 opacity-20 mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

        <div
          className={cn(
            "relative grid items-center gap-2 p-4 md:gap-10 md:p-12",
            s.image && !s.photo && "md:grid-cols-[1.05fr_1fr]",
            // Photo slides: room for the picture on top (phones) / keep the text on the left half (desktop).
            s.photo && "pt-[58vw] sm:pt-[52vw] md:min-h-[460px] md:pt-12 md:pr-[50%]",
          )}
        >
          {/* Stage (only when the item has a photo) */}
          {s.image && !s.photo && (
          <div className="relative mx-auto aspect-square w-full max-w-[220px] sm:max-w-[320px] md:max-w-[420px]">
            <motion.span
              key={s.handle + "-glow"}
              aria-hidden
              className="absolute inset-[8%] rounded-full blur-3xl"
              style={{ background: `radial-gradient(circle, ${s.swatch} 0%, transparent 70%)` }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.9, scale: 1 }}
              transition={{ duration: 0.8 }}
            />
            <span aria-hidden className="absolute inset-[6%] rounded-full border border-white/10" />
            <span aria-hidden className="absolute inset-[18%] rounded-full border border-dashed border-white/10" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={s.handle}
                className="absolute inset-[10%]"
                initial={reduce ? false : { opacity: 0, y: 30, rotate: -6, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, y: -20, rotate: 6, scale: 0.95 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {s.image && (
                  <SmartImage
                    data-spot-img=""
                    src={s.image.url}
                    alt={s.image.alt}
                    width={s.image.width}
                    height={s.image.height}
                    sizes="(min-width: 768px) 420px, 80vw"
                    className="size-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]"
                  />
                )}
              </motion.div>
            </AnimatePresence>
            <span aria-hidden className="absolute bottom-[6%] left-1/2 h-4 w-1/2 -translate-x-1/2 rounded-[50%] bg-black/30 blur-md" />
          </div>
          )}

          {/* Story */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={s.handle + "-copy"}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -16 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-start"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-co-gold uppercase backdrop-blur max-md:hidden">
                <Sparkles className="size-3.5" /> In the spotlight
              </span>
              <p className="font-hindi text-sm text-co-gold md:mt-4 md:text-lg" lang="hi">
                {s.titleHi}
              </p>
              <h3 className="text-[22px] leading-tight text-white md:text-5xl">{s.title.replace(/^(Wood|Cold)-Pressed\s+/, "")}</h3>
              {s.rating && showRating(s.reviewCount) ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/80 md:mt-2 md:text-sm">
                  <Star className="size-4 fill-[#f5b400] text-[#f5b400]" /> {s.rating.toFixed(1)} · {s.reviewCount} review{s.reviewCount === 1 ? "" : "s"}
                </p>
              ) : null}
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/85 md:mt-4 md:text-lg">{s.text}</p>
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-co-gold/40 px-2.5 py-1 text-[11px] font-semibold text-co-gold md:mt-5 md:gap-2 md:px-3.5 md:py-1.5 md:text-sm">
                <Check className="size-3.5 md:size-4" /> {s.note}
              </span>

              <div className="mt-4 flex w-full flex-wrap items-center gap-2 md:mt-7 md:w-auto md:gap-3">
                {s.variant && (
                  <p className="mr-2 flex items-baseline gap-2 max-md:basis-full">
                    <span className="text-[24px] font-extrabold text-white tabular-nums md:text-3xl">{formatMoney(s.variant.price)}</span>
                    {s.variant.mrp && s.variant.mrp > s.variant.price && <s className="text-sm text-white/55">{formatMoney(s.variant.mrp)}</s>}
                    <span className="text-xs text-white/60">{s.variant.title}</span>
                  </p>
                )}
                {s.variant && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async (e) => {
                      flyToCart(e.currentTarget.closest("[data-spot-root]")?.querySelector("[data-spot-img]") ?? null, s.image?.url);
                      setBusy(true);
                      try {
                        await add(s.variant!.id);
                        setAdded(true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="btn-shine inline-flex h-10 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-co-gold px-5 text-[13px] font-bold md:h-12 md:flex-none md:px-6 md:text-sm text-forest-deep transition-colors hover:bg-white disabled:opacity-70"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
                    {added ? "Added" : "Add to cart"}
                  </button>
                )}
                <Link href={`/products/${s.handle}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/30 px-4 text-[13px] font-semibold text-white md:h-12 md:px-5 md:text-sm transition-colors hover:bg-white/10">
                  Know more <ArrowRight className="size-4" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Thumbnail rail with autoplay progress */}
      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 md:mt-5 [scrollbar-width:none] md:mx-0 md:px-0">
        <div role="tablist" aria-label="Spotlight products" className="flex w-max gap-2.5 md:mx-auto">
          {items.map((it, n) => {
            const on = n === i;
            return (
              <button
                key={it.handle}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => pick(n)}
                className={cn(
                  "relative flex w-44 items-center gap-2.5 overflow-hidden rounded-2xl border bg-white/80 px-3 py-2.5 text-left md:w-52 md:gap-3 md:p-2 md:pr-3 backdrop-blur transition-all",
                  on ? "border-forest shadow-[0_12px_24px_-16px_rgba(7,47,27,0.6)]" : "border-line opacity-80 hover:opacity-100",
                )}
              >
                {it.image ? (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: `radial-gradient(circle, ${it.swatch}66, #f6efe2 70%)` }}>
                    <SmartImage src={it.image.url} alt="" width={48} height={48} className="size-10 object-contain" />
                  </span>
                ) : (
                  // No photo (owner's call): a small dot in the oil's colour instead of an empty frame.
                  <span aria-hidden className="size-3 shrink-0 rounded-full ring-4" style={{ background: it.swatch, boxShadow: `0 0 0 4px ${it.swatch}33` }} />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-forest-text md:text-sm">{it.title.replace(/^(Wood|Cold)-Pressed\s+/, "")}</span>
                  <span className="block truncate text-[11px] text-ink-muted md:text-xs">{it.note}</span>
                </span>
                {on && !reduce && (
                  <span
                    key={i + (hold ? "h" : "")}
                    aria-hidden
                    className="hero-progress absolute bottom-0 left-0 h-[3px] bg-forest"
                    style={{ animationDuration: `${AUTOPLAY}ms`, animationPlayState: hold ? "paused" : "running" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
