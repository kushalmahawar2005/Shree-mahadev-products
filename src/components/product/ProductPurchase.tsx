"use client";

import { useVariantImage } from "./VariantImage";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { DUR } from "@/lib/motion";
import { Zap } from "@/components/icons/duo";
import { QtyStepper } from "@/components/cart/CartLine";
import { useCart } from "@/components/cart/CartProvider";
import NumberFlow from "@number-flow/react";
import { DeliveryCheck } from "./DeliveryCheck";
import { NotifyMe } from "./NotifyMe";
import { flyToCart } from "@/lib/fly-to-cart";
import { formatMoney } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import { cn } from "@/lib/utils/cn";
import type { Product, ProductVariant } from "@/lib/commerce/types";
import { defaultVariant } from "@/lib/commerce/default-variant";

type Props = Pick<Product, "handle" | "title" | "variants" | "defaultSize"> & {
  image?: string;
  /** Quick view: no delivery check, no sticky bar, no URL ?size. */
  compact?: boolean;
  /** Offers row, shown right under the price. */
  offers?: React.ReactNode;
  /** Shown under the pincode check (PDP: the one trust strip). */
  footer?: React.ReactNode;
  /** "Only N left" below this many units (admin low-stock threshold). */
  lowStock?: number;
};

/** Price + size cards + qty / Add to cart + Buy now + pincode check, with a sticky bar once the CTA scrolls away. */
export function ProductPurchase({ handle, title, variants, defaultSize, image, compact = false, offers, footer, lowStock = 10 }: Props) {
  const { add, open } = useCart();
  // Admin's "Shown first" size, else 1 L / 1 kg, else the first size on sale.
  const preferred = defaultVariant({ variants, defaultSize }, (list) => list.find((v) => v.sizeValue === 1000)) ?? variants[0];
  const [variantId, setVariantId] = useState(preferred?.id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const [added, setAdded] = useState(false);
  const variant = variants.find((v) => v.id === variantId) ?? preferred;
  // Tell the gallery which size is chosen so it shows that size's photo.
  const { setSize } = useVariantImage();
  const sizeTitle = variant?.title;
  useEffect(() => {
    if (sizeTitle) setSize(sizeTitle);
  }, [sizeTitle, setSize]);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [nearFooter, setNearFooter] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    // Hide the bar once the footer comes into view (it would cover links there).
    const footer = document.querySelector("footer");
    const fo = footer ? new IntersectionObserver(([e]) => setNearFooter(e.isIntersecting), { threshold: 0 }) : null;
    if (footer) fo?.observe(footer);
    return () => {
      io.disconnect();
      fo?.disconnect();
    };
  }, []);

  if (!variant) return null;
  // Lowest price per 100 ml/g among sizes on sale (only worth a badge when sizes differ).
  const perUnit = (v: ProductVariant) => v.price.amount / Math.max(1, v.sizeValue);
  const onSale = variants.filter((v) => v.availableForSale && v.price.amount > 0);
  const bestValueId = onSale.length > 2 ? onSale.reduce((a, b) => (perUnit(b) < perUnit(a) ? b : a)).id : null;
  const canBuy = variant.availableForSale;

  async function addToCart(e?: React.MouseEvent) {
    if (!variant) return;
    flyToCart(e ? document.querySelector("[data-pdp-img]") : null, image);
    setBusy("add");
    try {
      await add(variant.id, qty);
      setAdded(true);
    } finally {
      setBusy(null);
    }
  }

  async function buyNow() {
    if (!variant) return;
    setBusy("buy");
    try {
      await add(variant.id, qty);
      // Full load: skips the cart drawer and lands straight on checkout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load on purpose
      window.location.assign("/checkout");
    } catch {
      setBusy(null);
    }
  }

  return (
    <div>
      <PriceBlock variant={variant} qty={qty} lowStock={lowStock} />
      {offers}

      <fieldset className="mt-4 min-w-0">
        <legend className="mb-1.5 text-sm font-semibold text-ink">
          Choose size <span className="font-normal text-ink-muted">· {variant.title}</span>
        </legend>
        <div role="radiogroup" aria-label="Size" className={cn(
            // Phones: wrapping rows whose last row stretches to fill (5 → 3 + 2, 4 → 2 × 2); sm+: one grid row.
            "flex flex-wrap gap-x-2 gap-y-4 pt-2.5 pb-1 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(82px,1fr))]",
            variants.length === 4 ? "[&>button]:basis-[40%]" : "[&>button]:basis-[28%]",
          )}>
          {variants.map((v) => {
            const on = v.id === variant.id;
            const off = !v.availableForSale;
            const badge = v.id === bestValueId ? "Best value" : v.id === preferred?.id ? "Most popular" : null;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                onClick={() => {
                  setVariantId(v.id);
                  setAdded(false);
                  if (!compact) {
                    const url = new URL(window.location.href);
                    url.searchParams.set("size", v.title.replace(/\s+/g, "").toLowerCase());
                    window.history.replaceState(window.history.state, "", url);
                  }
                }}
                disabled={off && !v.outOfStock}
                aria-checked={on}
                aria-label={`${v.title}${v.availableForSale ? "" : v.outOfStock ? ", out of stock" : ", price coming soon"}`}
                className={cn(
                  "relative flex min-w-[74px] flex-1 shrink-0 flex-col items-center rounded-2xl border-[1.5px] px-1.5 pt-2.5 pb-2 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  on ? "border-forest bg-co-brand-soft" : "border-line bg-white hover:border-forest/30",
                )}
              >
                {on && <motion.span layoutId={`size-check-${handle}`} className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-forest text-white"><Check className="size-3" strokeWidth={3} /></motion.span>}
                <span className={cn("text-[13px] font-bold", v.outOfStock && "line-through", on ? "text-forest" : "text-ink")}>{v.title}</span>
                {badge && (
                  <span className={cn("absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", badge === "Best value" ? "bg-co-accent-soft text-co-accent-ink ring-1 ring-co-accent/30" : "bg-forest text-white")}>
                    {badge}
                  </span>
                )}
                <span className="mt-0.5 text-[13px] font-semibold text-ink tabular-nums">{v.outOfStock ? "Sold out" : v.price.amount ? formatMoney(v.price) : "Soon"}</span>
                {v.price.amount > 0 && !v.outOfStock && unitPrice(v) && <span className="text-[10px] whitespace-nowrap text-ink-muted tabular-nums">{unitPrice(v)?.replace(" / 100 ", "/100 ")}</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      {variant.outOfStock ? (
        <div ref={ctaRef} className="mt-6 rounded-2xl border border-line bg-white p-4">
          <p className="mb-2 font-semibold text-alert">Out of stock</p>
          <NotifyMe key={variant.id} variantKey={variant.id} sizeLabel={`${title} ${variant.title}`} />
        </div>
      ) : (
        <div ref={ctaRef} className="mt-4 space-y-2">
          {/* One row on sm+: qty · Add to cart · Buy now. Phones: Buy now wraps to its own line. */}
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <QtyStepper value={qty} min={1} onChange={setQty} label={title} disabled={!canBuy} />
            <button
              type="button"
              disabled={!canBuy || !!busy}
              onClick={addToCart}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-4 text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-mid disabled:opacity-60"
            >
              {busy === "add" ? <LoadingDots /> : added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
              {!canBuy ? "Price coming soon" : added ? "Added" : "Add to cart"}
            </button>
            {canBuy && (
              <button
                type="button"
                disabled={!!busy}
                onClick={buyNow}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-co-accent px-4 text-[15px] font-semibold whitespace-nowrap text-ink transition-colors hover:brightness-95 disabled:opacity-60 sm:w-auto sm:flex-1"
              >
                {busy === "buy" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Buy now
              </button>
            )}
          </div>
          {added && (
            <button type="button" onClick={open} className="w-full text-center text-sm font-semibold text-forest underline-offset-2 hover:underline">
              View cart
            </button>
          )}
        </div>
      )}
      {canBuy && !compact && <DeliveryCheck variant={variant} qty={qty} />}
      {footer}

      {/* Sticky add-to-cart once the main CTA scrolls away */}
      <AnimatePresence>
        {showSticky && !nearFooter && canBuy && !compact && (
          // Slides up from the bottom on every screen; hidden near the footer.
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: DUR.stickyBar, ease: "easeInOut" }}
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-white/95 shadow-[0_-10px_24px_-18px_rgba(7,47,27,0.35)] backdrop-blur md:bottom-0 md:pb-[env(safe-area-inset-bottom)]"
          >
            <div className="mx-auto flex max-w-[1360px] items-center gap-3 px-4 py-3 md:px-8">
              {image && (
                <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-page md:grid">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative thumb */}
                  <img src={image} alt="" className="size-9 object-contain" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  <span className="hidden md:inline">{title} · </span>
                  {variant.title}
                </p>
                <p className="font-extrabold text-forest tabular-nums">{formatMoney(variant.price.amount * qty)}</p>
              </div>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => addToCart()}
                className="inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-60"
              >
                {busy === "add" ? <LoadingDots /> : <ShoppingBag className="size-4" />} Add to cart
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={buyNow}
                className="hidden h-11 items-center rounded-full border border-forest bg-white px-5 text-sm font-semibold text-forest hover:bg-co-brand-soft disabled:opacity-60 sm:inline-flex"
              >
                Buy now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PriceBlock({ variant, qty, lowStock }: { variant: ProductVariant; qty: number; lowStock: number }) {
  const unit = unitPrice(variant);
  const save = variant.compareAtPrice ? variant.compareAtPrice.amount - variant.price.amount : 0;
  return (
    <div aria-live="polite" >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={variant.availableForSale ? "price" : variant.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {variant.price.amount ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <NumberFlow
                value={variant.price.amount}
                format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
                locales="en-IN"
                className="text-[32px] leading-none font-extrabold tracking-tight text-ink tabular-nums"
              />
              {variant.compareAtPrice && save > 0 && (
                <>
                  <span className="text-sm text-ink-muted">
                    MRP <s className="tabular-nums">{formatMoney(variant.compareAtPrice)}</s>
                  </span>
                  <span className="rounded-full bg-co-success-soft px-2.5 py-1 text-xs font-semibold text-co-success tabular-nums">
                    {Math.round((save / variant.compareAtPrice.amount) * 100)}% off · save {formatMoney(save)}
                  </span>
                </>
              )}
            </div>
          ) : (
            <p className="text-2xl font-semibold text-ink-muted">Price coming soon</p>
          )}
          {/* One small line: unit price, taxes, and stock (low stock in mustard). */}
          <p className="mt-2 text-[13px] text-ink-muted">
            {unit ? `${unit} · ` : ""}Inclusive of all taxes
            {qty > 1 && variant.price.amount ? ` · ${qty} for ${formatMoney(variant.price.amount * qty)}` : ""}
            {variant.availableForSale && (variant.stock ?? Infinity) <= lowStock ? (
              <b className="font-semibold text-co-accent-ink"> · Only {variant.stock} left</b>
            ) : variant.availableForSale ? (
              <span className="font-semibold text-forest"> · In stock</span>
            ) : null}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
