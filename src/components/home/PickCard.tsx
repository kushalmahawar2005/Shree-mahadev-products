"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Check, Loader2, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { Sparkles } from "@/components/icons/duo";
import { useCart } from "@/components/cart/CartProvider";
import { NotifyMe } from "@/components/product/NotifyMe";
import { SmartImage, isPackshot } from "@/components/ui/SmartImage";
import { variantImage } from "@/lib/image-loader";
import { flyToCart } from "@/lib/fly-to-cart";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import type { PickProduct } from "./pickProduct";
import { SizeChips } from "./SizeChips";
import { defaultVariant } from "@/lib/commerce/default-variant";
import { stageClass, stageImg, stageStyle } from "@/components/product/cardStage";

export type { PickProduct };

const BADGES: Record<string, string> = { bestseller: "Bestseller", new: "New", "best-value": "Best value" };
/** Star chip only once there are enough reviews to mean something. */
const MIN_REVIEWS = 5;
const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed /, "");

/**
 * Product card: photo, name, rating, USP, price, size chips and
 * add-to-cart. Once a size is in the cart the button becomes a − qty + stepper.
 */
export function PickCard({ product, priority = false }: { product: PickProduct; priority?: boolean }) {
  const { cart, add, update, open: openCart } = useCart();
  // Per-card busy flag, so only the clicked card reacts (the cart's own pending flag is shared).
  const [busy, setBusy] = useState(false);
  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  // Sizes we can show: on sale, or priced but sold out (shown struck through with "Notify me").
  const available = product.variants.filter((v) => v.availableForSale || v.outOfStock);
  const [selectedId, setSelectedId] = useState((defaultVariant(product) ?? available[0])?.id);
  const [added, setAdded] = useState(false);
  const selected = available.find((v) => v.id === selectedId) ?? available[0];
  const href = `/products/${product.handle}`;
  const [first] = product.images;
  // The photo follows the chosen size. No hover photo swap (no "lifestyle" flag on photos, and admin
  // uploads include label / ingredient shots): hover is a subtle 1.04 zoom only.
  const img = variantImage(product.images, selected?.title) ?? first;
  // If a photo fails to load: this product's bottle placeholder, then the brand mark. Never a broken icon.
  const [failed, setFailed] = useState<Record<string, number>>({});
  const fallbackFor = (url: string) => {
    const n = failed[url] ?? 0;
    return n === 0 ? url : n === 1 ? `/images/placeholder-${product.handle}.svg` : "/logo.svg";
  };
  const onImgError = (url: string) => setFailed((f) => ({ ...f, [url]: Math.min((f[url] ?? 0) + 1, 2) }));
  const full = isPackshot(img);
  // Hover swaps only to a lifestyle / extra-angle photo (an admin upload). Catalog packshots (other
  // sizes' fronts, back labels with barcode/ingredients) never swap in; then hover is just a 1.04 zoom.
  const badgeTag = (["bestseller", "new", "best-value"] as const).find((t) => product.tags.includes(t));
  // Unit price repeats the price for 100 ml / 100 g packs, so skip it there.
  const per = selected && selected.sizeValue !== 100 ? unitPrice(selected) : null;
  const save = selected?.compareAtPrice && selected.compareAtPrice.amount > selected.price.amount ? selected.compareAtPrice.amount - selected.price.amount : 0;
  const pctOff = save > 0 && selected?.compareAtPrice ? Math.round((save / selected.compareAtPrice.amount) * 100) : 0;
  const line = cart?.lines.find((l) => l.variant.id === selected?.id);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(t);
  }, [added]);

  const onAdd = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selected) return;
    flyToCart(e.currentTarget.closest("article")?.querySelector("[data-card-media]") ?? null, img?.url);
    await withBusy(() => add(selected.id));
    setAdded(true);
  };

  /** Size chips + add button / stepper / notify me. Rendered in the hover panel (desktop) and inline (mobile). */
  const actions = () =>
    available.length === 0 ? (
      <Link
        href={href}
        className="inline-flex h-8 w-full items-center justify-center rounded-full border border-forest px-4 text-[12.5px] sm:h-11 sm:text-sm font-medium text-forest transition-colors hover:bg-forest hover:text-white"
      >
        Coming soon · View details
      </Link>
    ) : (
      <div className="space-y-2 sm:space-y-2.5">
        <SizeChips
          sizes={available.map((v) => ({ id: v.id, title: v.title, soldOut: !!v.outOfStock }))}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          max={3}
          label={`Size for ${product.title}`}
        />
        {selected?.outOfStock ? (
          <NotifyMe key={selected.id} variantKey={selected.id} sizeLabel={`${shortTitle(product.title)} ${selected.title}`} compact />
        ) : line && !added ? (
          <motion.div layout className="flex h-8 items-center gap-1 rounded-full bg-forest p-0.5 text-white sm:h-11 sm:p-1" aria-label={`${line.quantity} in cart`}>
            <button
              type="button"
              disabled={busy}
              onClick={() => withBusy(() => update(line.id, line.quantity - 1))}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 sm:size-9 transition-colors hover:bg-white/20 disabled:opacity-60"
              aria-label="Remove one"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              onClick={openCart}
              className="flex flex-1 items-center justify-center gap-1.5 text-sm whitespace-nowrap"
              aria-label="View cart"
            >
              <Check className="hidden size-4 text-mustard sm:block" strokeWidth={2.5} aria-hidden />
              <span className="relative inline-grid h-5 min-w-4 overflow-hidden text-base leading-5 font-extrabold tabular-nums">
                {busy ? (
                  <Loader2 className="size-4 animate-spin self-center" />
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={line.quantity} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.2 }}>
                      {line.quantity}
                    </motion.span>
                  </AnimatePresence>
                )}
              </span>
              <span className="hidden font-medium text-white/80 sm:inline">in cart</span>
              <span className="ml-1 hidden text-xs font-semibold text-mustard underline-offset-2 hover:underline sm:inline">View</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => withBusy(() => update(line.id, line.quantity + 1))}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 sm:size-9 transition-colors hover:bg-white/20 disabled:opacity-60"
              aria-label="Add one more"
            >
              <Plus className="size-4" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            layout
            type="button"
            disabled={busy}
            onClick={onAdd}
            className="btn-shine inline-flex h-8 w-full items-center justify-center gap-1.5 overflow-hidden rounded-full bg-forest px-3 text-[12.5px] sm:h-11 sm:gap-2 sm:text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-forest-mid disabled:opacity-60"
            aria-label={`Add ${product.title} ${selected?.title ?? ""} to cart`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={added ? "added" : "add"}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-2"
              >
                {added ? <Check className="size-4 sm:size-[18px]" strokeWidth={2.5} aria-hidden /> : <ShoppingCart className="size-4 sm:size-[18px]" strokeWidth={2} aria-hidden />}
                <span className="sm:hidden">{added ? "Added" : "Add"}</span>
                <span className="hidden sm:inline">{added ? "Added" : "Add to cart"}</span>
              </motion.span>
            </AnimatePresence>
          </motion.button>
        )}
      </div>
    );

  return (
    <article className="group @container flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(7,47,27,0.05)] transition-[box-shadow,transform] duration-300 md:hover:-translate-y-0.5 md:hover:shadow-[0_18px_34px_-22px_rgba(7,47,27,0.45)]">
      {/* 1. Photo on a tinted stage inset from the white card */}
      <div className="relative p-1.5 sm:p-2">
        <Link
          href={href}
          data-card-media
          className={stageClass}
          style={stageStyle(product.swatch)}
          tabIndex={-1}
          aria-hidden
        >
          {img && (
            <SmartImage
              key={img.url}
              src={fallbackFor(img.url)}
              onError={() => onImgError(img.url)}
              alt=""
              width={img.width}
              height={img.height}
              priority={priority}
              sizes="(min-width: 1024px) 300px, 48vw"
              className={cn(
                "absolute inset-0 size-full [transition:opacity_0.3s_ease-in-out,visibility_0.3s,transform_0.5s_ease-out]",
                cn(full ? "object-contain sm:object-cover" : "object-contain p-[6%]", "md:group-hover:scale-[1.04]", stageImg),
              )}
            />
          )}
          {/* Stars (real reviews only) sit on the photo, so cards with and without reviews are the same height. */}
          {product.rating && (product.reviewCount ?? 0) >= MIN_REVIEWS ? (
            <span
              className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink shadow-sm backdrop-blur-sm sm:text-xs"
              aria-label={`Rated ${product.rating.toFixed(1)} out of 5 from ${product.reviewCount} reviews`}
            >
              <Star className="size-3.5 fill-[#f5b400] text-[#f5b400]" aria-hidden />
              {product.rating.toFixed(1)}
              <span className="font-normal text-ink-muted">({product.reviewCount})</span>
            </span>
          ) : null}
          {badgeTag && (
            <span className="shine-badge tag-breathe absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-forest px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:top-2.5 sm:left-2.5 sm:px-2.5 sm:py-1 sm:text-[11px]">
              <Sparkles className="size-2.5 text-mustard sm:size-3" aria-hidden />
              {/* Narrow cards (under ~168px wide): icon only, so it never runs into the % off tag. */}
              <span className="@max-[168px]:sr-only">{BADGES[badgeTag]}</span>
            </span>
          )}
          {/* Phones: the discount sits on the photo so price + MRP keep to one line. */}
          {pctOff > 0 && (
            <span className="shine-badge tag-breathe absolute top-2 right-2 rounded-full bg-co-success px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums sm:hidden">{pctOff}% off</span>
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pt-2 pb-2.5 sm:p-4">
        {/* 2. Name + Hindi name */}
        {/* Fixed two lines (English, then Hindi) so prices, chips and CTAs line up across cards */}
        <h3 className="text-[13px] leading-snug font-bold text-ink sm:text-base">
          <Link href={href} className="block truncate hover:text-forest hover:underline" title={shortTitle(product.title)}>
            {shortTitle(product.title)}
          </Link>
          <span lang="hi" className="font-hindi block truncate text-[12px] font-normal text-sale sm:text-[15px]">
            {product.titleHi}
          </span>
        </h3>

        {/* 3. One-line USP: every card has the same text height, so prices and buttons line up with no gaps. */}
        <p className="mt-1 line-clamp-2 min-h-[calc(2*1.625em)] text-[13px] leading-[1.625] text-ink-muted max-sm:hidden">
          {product.shortDescription}
        </p>

        {/* 5. Price: selling price first, MRP struck + % off, then the unit price (follows the size chip) */}
        {selected && (
          <div className="pt-1.5 sm:pt-2.5" aria-live="polite">
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 sm:gap-x-2">
              <span className="text-[15px] leading-none font-bold text-forest tabular-nums sm:text-2xl">{formatMoney(selected.price)}</span>
              {save > 0 && <s className="text-[11px] text-ink-muted tabular-nums sm:text-sm">{formatMoney(selected.compareAtPrice!)}</s>}
              {pctOff > 0 && (
                <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest tabular-nums max-sm:hidden">{pctOff}% off</span>
              )}
            </p>
            {selected.outOfStock ? (
              <p className="mt-1 text-xs font-semibold text-sale">Out of stock</p>
            ) : (
              // Always one line tall (even for 100 ml packs) so every card's chips start on the same line.
              <p className="mt-1 min-h-[1lh] text-[11px] text-ink-muted tabular-nums sm:text-xs">{per ?? "\u00a0"}</p>
            )}
          </div>
        )}

        {/* 6. Sizes + add to cart / stepper (always visible) */}
        {/* Spare height (e.g. a card without stars) goes above the buttons, never between text and price. */}
        <div className="mt-auto pt-1.5 sm:pt-3">{actions()}</div>
      </div>
    </article>
  );
}
