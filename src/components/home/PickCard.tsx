"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils/cn";
import { DISCOUNT_BADGE_MIN, discountPercent, formatMoney } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import type { PickProduct } from "./pickProduct";
import { SizeChips } from "./SizeChips";
import { NotifyMe } from "@/components/product/NotifyMe";

export type { PickProduct };

const BADGES: Record<string, string> = { bestseller: "Bestseller", new: "New" };

const STAR = "M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z";

/** 5 stars with partial fill for decimals (e.g. 4.6 → last star 60% filled). */
function Stars({ value }: { value: number }) {
  return (
    <span className="flex" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative size-3.5">
            <svg viewBox="0 0 20 20" className="absolute inset-0 size-3.5 text-mustard/25" fill="currentColor">
              <path d={STAR} />
            </svg>
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg viewBox="0 0 20 20" className="size-3.5 text-mustard" fill="currentColor">
                <path d={STAR} />
              </svg>
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Product card (AGENTS.md §9): photo, name, Hindi name, rating, one row of size chips, price + unit price, add button. */
export function PickCard({ product, priority = false }: { product: PickProduct; priority?: boolean }) {
  const { add, pending } = useCart();
  // Sizes we can show: on sale, or priced but sold out (shown struck through with "Notify me").
  const available = product.variants.filter((v) => v.availableForSale || v.outOfStock);
  const [selectedId, setSelectedId] = useState((available.find((v) => v.availableForSale) ?? available[0])?.id);
  const [added, setAdded] = useState(false);
  const selected = available.find((v) => v.id === selectedId) ?? available[0];
  const off = selected ? discountPercent(selected.price, selected.compareAtPrice) : 0;
  const href = `/products/${product.handle}`;
  const [img, img2] = product.images;
  const badgeTag = (["bestseller", "new"] as const).find((t) => product.tags.includes(t));
  // Unit price repeats the price for 100 ml / 100 g packs, so skip it there.
  const per = selected && selected.sizeValue !== 100 ? unitPrice(selected) : null;

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white">
      {/* 1. Image */}
      <Link href={href} data-card-media className="relative block aspect-square overflow-hidden bg-khaki-soft" tabIndex={-1} aria-hidden>
        {img && (
          <SmartImage
            src={img.url}
            alt=""
            width={img.width}
            height={img.height}
            priority={priority}
            sizes="(min-width: 1024px) 280px, 45vw"
            className={cn(
              "absolute inset-[5%] size-[90%] object-contain transition-[transform,opacity] duration-500 ease-out md:group-hover:scale-[1.04]",
              img2 && "md:group-hover:opacity-0",
            )}
          />
        )}
        {img2 && (
          <SmartImage
            src={img2.url}
            alt=""
            width={img2.width}
            height={img2.height}
            sizes="(min-width: 1024px) 280px, 45vw"
            className="absolute inset-[5%] size-[90%] object-contain opacity-0 transition-[transform,opacity] duration-500 ease-out md:group-hover:scale-[1.04] md:group-hover:opacity-100"
          />
        )}
        {badgeTag && (
          <span className="absolute top-3 right-3 rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-white">{BADGES[badgeTag]}</span>
        )}
        {off >= DISCOUNT_BADGE_MIN && (
          <span className="absolute top-3 left-3 rounded-full bg-khaki-soft px-3 py-1 text-xs font-bold text-sale shadow-sm">{off}% off</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {/* Name, Hindi name, real rating, and product description */}
        <h3 className="line-clamp-2 min-h-[2.8em] text-base leading-snug font-semibold text-forest-text sm:text-lg">
          <Link href={href} className="hover:underline">
            {product.title.replace(/^(Wood|Cold)-Pressed /, "")}
          </Link>
        </h3>
        <p lang="hi" className="mt-0.5 truncate text-sm text-ink-muted">
          {product.titleHi}
        </p>
        {product.rating && product.reviewCount ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm" aria-label={`Rated ${product.rating.toFixed(1)} out of 5 from ${product.reviewCount} reviews`}>
            <Stars value={product.rating} />
            <span className="font-semibold text-ink">{product.rating.toFixed(1)}</span>
            <span className="text-ink-muted">({product.reviewCount})</span>
          </p>
        ) : null}
        <p className="mt-2 line-clamp-2 min-h-[2.7em] text-sm leading-relaxed text-ink-muted">{product.shortDescription}</p>

        <div className="mt-auto pt-3">
        {available.length > 0 ? (
          <>
            {/* 5. Sizes: whole chips only, "+N" for the rest */}
            <SizeChips
              sizes={available.map((v) => ({ id: v.id, title: v.title, soldOut: !!v.outOfStock }))}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              label={`Size for ${product.title}`}
            />

            {/* 6. Price row */}
            <div className="mt-3 min-h-[56px]" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={selected?.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {selected!.compareAtPrice && selected!.compareAtPrice.amount > selected!.price.amount && (
                      <span className="text-xs text-ink-muted">MRP <s>{formatMoney(selected!.compareAtPrice)}</s></span>
                    )}
                    <span className="text-2xl leading-none font-bold text-forest">{formatMoney(selected!.price)}</span>
                  </p>
                  {selected?.outOfStock ? (
                    <p className="text-[13px] font-semibold text-sale">Out of stock</p>
                  ) : (
                    per && <p className="text-[13px] text-ink-muted">{per}</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* 7. Add to cart (or Notify me when the size is sold out) */}
            {selected?.outOfStock ? (
              <div className="mt-3">
                <NotifyMe key={selected.id} variantKey={selected.id} sizeLabel={`${product.title.replace(/^(Wood|Cold)-Pressed /, "")} ${selected.title}`} compact />
              </div>
            ) : (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!selected) return;
                await add(selected.id);
                setAdded(true);
              }}
              className="btn-shine mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-forest px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-forest-mid disabled:opacity-60"
              aria-label={`Add ${product.title} ${selected?.title ?? ""} to cart`}
            >
              {added ? (
                <>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Added
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
                  </svg>
                  Add to cart
                </>
              )}
            </button>
            )}
          </>
        ) : (
          <Link
            href={href}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-forest px-4 text-sm font-semibold text-forest transition-colors duration-200 hover:bg-forest hover:text-white"
          >
            Coming soon · View details
          </Link>
        )}
      </div>
      </div>
    </article>
  );
}
