"use client";

import { showRating } from "@/lib/utils/reviews";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
   * The landscape photo fades into `bg` on desktop. A separate portrait can fill the phone card
   * behind a tinted glass panel.
   */
  photo?: {
    url: string;
    alt: string;
    bg: string;
    position?: string;
    mobileUrl?: string;
    mobileTint?: string;
    tabletPortrait?: boolean;
  };
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
  // Keep the animated card height in sync with the image and copy.
  const contentRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (hold || reduce || items.length < 2) return;
    const t = setTimeout(() => {
      setI((n) => (n + 1) % items.length);
      setAdded(false);
    }, AUTOPLAY);
    return () => clearTimeout(t);
  }, [i, hold, reduce, items.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !window.matchMedia("(width < 48rem)").matches) return;
    const active = rail.querySelector('[aria-selected="true"]');
    if (!active) return;

    const frame = rail.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left >= frame.left + 16 && tab.right <= frame.right - 16) return;
    rail.scrollTo({
      left: rail.scrollLeft + (tab.left + tab.right - frame.left - frame.right) / 2,
      behavior: reduce ? "instant" : "smooth",
    });
  }, [i, reduce]);

  if (!s) return null;
  const isJamunHoney = s.handle === "jamun-raw-honey";
  const background = s.photo?.bg ?? `linear-gradient(135deg, ${s.color} 0%, ${s.color}e6 55%, #041d10 100%)`;
  const mobileTint = s.photo?.mobileTint ?? s.color;
  const { variant } = s;
  const salePrice = variant ? formatMoney(variant.price) : null;
  const originalPrice = variant?.mrp && variant.mrp > variant.price ? formatMoney(variant.mrp) : null;
  const pick = (n: number) => {
    setI(n);
    setAdded(false);
  };

  return (
    <div onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocusCapture={() => setHold(true)} onBlurCapture={() => setHold(false)}>
      <motion.div
        className="relative overflow-hidden rounded-3xl text-white shadow-[0_40px_80px_-50px_rgba(7,47,27,0.8)] max-md:h-auto! md:rounded-[32px]"
        animate={{ height }}
        initial={false}
        transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* colour mood crossfades per product */}
        <AnimatePresence initial={false}>
          <motion.div
            key={s.handle + "-bg"}
            className="absolute inset-0 [background:var(--spotlight-mobile-bg)] md:[background:var(--spotlight-desktop-bg)]"
            style={{
              "--spotlight-mobile-bg": s.photo ? mobileTint : background,
              "--spotlight-desktop-bg": background,
            } as CSSProperties}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        </AnimatePresence>

        <div
          ref={contentRef}
          className={cn(
            // Same height for every slide on desktop, so switching never resizes the card there.
            "relative grid items-center md:min-h-[460px] md:gap-10 md:p-12",
            !s.photo && "gap-2 p-4",
            s.image && !s.photo && "md:grid-cols-[1.05fr_1fr]",
          )}
        >
          {/* Select the portrait at the browser level so phones only request one version. */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 md:left-auto md:w-[62%]",
              s.photo?.tabletPortrait && "md:max-lg:w-1/2",
              !s.photo && "hidden",
            )}
          >
            <AnimatePresence initial={false}>
              {s.photo && (
                <motion.div
                  key={s.handle + "-photo"}
                  className="absolute inset-0"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <picture>
                    {s.photo.mobileUrl && (
                      <source media={s.photo.tabletPortrait ? "(width < 64rem)" : "(width < 48rem)"} srcSet={s.photo.mobileUrl} type="image/webp" />
                    )}
                    <SmartImage
                      src={s.photo.url}
                      alt={s.photo.alt}
                      fill
                      unoptimized={s.photo.url.startsWith("/") && s.photo.url.endsWith(".webp")}
                      sizes="(min-width: 768px) 62vw, 100vw"
                      className={cn(
                        "object-cover object-top md:[mask-image:linear-gradient(to_right,transparent_0%,black_38%)] md:[object-position:var(--spotlight-desktop-position)]",
                        s.photo.tabletPortrait && "md:max-lg:object-top md:max-lg:[mask-image:linear-gradient(to_right,transparent_0%,black_16%)]",
                      )}
                      style={{ "--spotlight-desktop-position": s.photo.position ?? "70% center" } as CSSProperties}
                    />
                  </picture>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {s.photo && (
            <div
              aria-hidden
              className={cn("aspect-[3/2] max-h-[19rem] md:hidden", isJamunHoney && "min-[520px]:max-h-[24rem]")}
            />
          )}
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
          {/* Standalone product shot for slides without a lifestyle photo. */}
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
              className={cn(
                "relative flex min-w-0 flex-col items-start",
                s.photo && "max-md:isolate max-md:transform-none! max-md:px-3 max-md:pt-1 max-md:pb-3 sm:max-md:px-4 md:max-w-[58%]",
                isJamunHoney && s.photo && "md:max-xl:max-w-[50%]",
              )}
            >
              {s.photo && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 -z-10 backdrop-blur-[10px] [mask-image:linear-gradient(to_bottom,transparent,black_26%)] md:hidden"
                  style={{ background: `linear-gradient(180deg, ${mobileTint}68 0%, ${mobileTint}d9 29%, ${mobileTint}e6 100%)` }}
                />
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-co-gold uppercase backdrop-blur max-md:hidden">
                <Sparkles className="size-3.5" /> In the spotlight
              </span>
              <div className={s.photo ? "grid w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2.5 md:contents" : "contents"}>
                <div className="min-w-0 md:contents">
                  <p className={cn("font-hindi text-sm text-co-gold md:mt-4 md:text-lg", s.photo && "max-md:text-[11px] max-md:leading-tight")} lang="hi">
                    {s.titleHi}
                  </p>
                  <h3
                    className={cn(
                      "text-[clamp(1.375rem,6.25vw,1.75rem)] leading-tight text-white md:text-5xl",
                      s.photo && "max-md:mt-0.5 max-md:text-[clamp(1.125rem,5.6vw,1.5rem)]",
                    )}
                  >
                    {s.title.replace(/^(Wood|Cold)-Pressed\s+/, "")}
                  </h3>
                </div>
                {s.photo && variant && (
                  <p className="text-right whitespace-nowrap md:hidden">
                    <span className="block text-[22px] leading-none font-extrabold text-white tabular-nums">{salePrice}</span>
                    <span className="mt-1 flex justify-end gap-1.5 text-[10px] leading-tight text-white/80">
                      {originalPrice && <s className="text-white/65">{originalPrice}</s>}
                      <span>{variant.title}</span>
                    </span>
                  </p>
                )}
              </div>
              {s.rating && showRating(s.reviewCount) ? (
                <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs text-white/80 md:mt-2 md:text-sm", s.photo && "max-md:hidden")}>
                  <Star className="size-4 fill-[#f5b400] text-[#f5b400]" /> {s.rating.toFixed(1)} · {s.reviewCount} review{s.reviewCount === 1 ? "" : "s"}
                </p>
              ) : null}
              <p className={cn("mt-2 max-w-md text-[14px] leading-normal text-white/90 md:mt-4 md:text-lg md:leading-relaxed md:text-white/85", s.photo && "max-md:hidden")}>{s.text}</p>
              <span className={cn(
                "mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-co-gold/40 px-2.5 py-1 text-[11px] font-semibold text-co-gold md:mt-5 md:gap-2 md:px-3.5 md:py-1.5 md:text-sm",
                s.photo && "max-md:mt-1 max-md:border-0 max-md:p-0",
              )}>
                <Check className={cn("size-3.5 md:size-4", s.photo && "max-md:size-3")} /> {s.note}
              </span>

              <div className={cn("mt-4 grid w-full grid-cols-2 items-center gap-2.5 md:mt-7 md:flex md:w-auto md:flex-wrap md:gap-3", s.photo && "max-md:mt-2.5 max-md:gap-2")}>
                {variant && (
                  <p className={cn("col-span-2 flex flex-wrap items-baseline gap-x-2 md:mr-2", s.photo && "max-md:hidden")}>
                    <span className="text-[24px] font-extrabold text-white tabular-nums md:text-3xl">{salePrice}</span>
                    {originalPrice && <s className="text-sm text-white/55">{originalPrice}</s>}
                    <span className="text-xs text-white/60">{variant.title}</span>
                  </p>
                )}
                {variant && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async (e) => {
                      flyToCart(e.currentTarget.closest("[data-spot-root]")?.querySelector("[data-spot-img]") ?? null, s.image?.url);
                      setBusy(true);
                      try {
                        await add(variant.id);
                        setAdded(true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="btn-shine inline-flex h-11 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-co-gold px-2.5 text-[13px] font-bold whitespace-nowrap text-forest-deep transition-colors hover:bg-white disabled:opacity-70 md:h-12 md:px-6 md:text-sm"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
                    {added ? "Added" : "Add to cart"}
                  </button>
                )}
                <Link
                  href={`/products/${s.handle}`}
                  className={cn(
                    "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/30 px-2.5 text-[13px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-white/10 md:h-12 md:px-5 md:text-sm",
                    !variant && "col-span-2",
                  )}
                >
                  Know more <ArrowRight className="size-4" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Thumbnail rail with autoplay progress */}
      <div ref={railRef} className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] max-md:snap-x max-md:snap-proximity max-md:scroll-px-4 md:mx-0 md:mt-5 md:px-0">
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
                  "relative flex w-44 items-center gap-2.5 overflow-hidden rounded-2xl border bg-white/80 px-3 py-2.5 text-left backdrop-blur transition-all max-md:snap-start md:w-52 md:gap-3 md:p-2 md:pr-3",
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
