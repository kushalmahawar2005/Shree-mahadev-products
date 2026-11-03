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

export type { PickProduct };

const BADGES: Record<string, string> = { bestseller: "Bestseller", new: "New" };

function Stars() {
  return (
    <span className="flex text-mustard" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Product card (AGENTS.md §9): photo, name, Hindi name, rating, one row of size chips, price + unit price, add button. */
export function PickCard({ product, priority = false }: { product: PickProduct; priority?: boolean }) {
  const { add, pending } = useCart();
  const available = product.variants.filter((v) => v.availableForSale);
  const [selectedId, setSelectedId] = useState(available[0]?.id);
  const [added, setAdded] = useState(false);
  const selected = available.find((v) => v.id === selectedId) ?? available[0];
  const off = selected ? discountPercent(selected.price, selected.compareAtPrice) : 0;
  const href = `/products/${product.handle}`;
  const [img, img2] = product.images;
  const badgeTag = (["bestseller", "new"] as const).find((t) => product.tags.includes(t));
  const per = selected ? unitPrice(selected) : null;

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-[#EFE6D2] bg-white p-3 md:p-4">
      {/* 1. Image */}
      <Link href={href} data-card-media className="relative block aspect-square overflow-hidden rounded-xl bg-khaki-soft" tabIndex={-1} aria-hidden>
        <span className="absolute bottom-[9%] left-1/2 h-[6%] w-[46%] -translate-x-1/2 rounded-[50%] bg-forest-deep/10 blur-[6px]" />
        {img && (
          <SmartImage
            src={img.url}
            alt=""
            width={img.width}
            height={img.height}
            priority={priority}
            sizes="(min-width: 1024px) 280px, 45vw"
            className={cn(
              "absolute inset-[10%] size-[80%] object-contain transition-[transform,opacity] duration-500 ease-out md:group-hover:scale-[1.04]",
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
            className="absolute inset-[10%] size-[80%] object-contain opacity-0 transition-[transform,opacity] duration-500 ease-out md:group-hover:scale-[1.04] md:group-hover:opacity-100"
          />
        )}
        {badgeTag && (
          <span className="absolute bottom-2 left-2 rounded-full bg-forest px-2 py-0.5 text-[11px] font-semibold text-white md:top-2 md:bottom-auto md:px-2.5 md:text-xs">{BADGES[badgeTag]}</span>
        )}
        {off >= DISCOUNT_BADGE_MIN && (
          <span className="absolute top-2 right-2 rounded-full bg-mustard px-2 py-0.5 text-[11px] font-bold text-forest-deep md:px-2.5 md:text-xs">{off}% off</span>
        )}
      </Link>

      {/* 2–4. Name, Hindi name, rating */}
      <h3 className="mt-3 truncate text-base leading-snug font-semibold text-forest-text md:text-lg">
        <Link href={href} className="hover:underline">
          {product.title.replace(/^(Wood|Cold)-Pressed /, "")}
        </Link>
      </h3>
      <p lang="hi" className="truncate text-sm text-ink-muted">
        {product.titleHi}
      </p>
      {/* Only real ratings (Judge.me). No placeholder stars. */}
      {product.rating && product.reviewCount ? (
        <p className="mt-1 flex items-center gap-1 text-sm">
          <Stars />
          <span className="font-semibold text-ink">{product.rating.toFixed(1)}</span>
          <span className="text-ink-muted">({product.reviewCount})</span>
        </p>
      ) : null}

      <div className="mt-auto pt-3">
        {available.length > 0 ? (
          <>
            {/* 5. Sizes: one row, never wraps; scrolls if more than fit */}
            <div
              role="radiogroup"
              aria-label={`Size for ${product.title}`}
              className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1"
            >
              {available.map((v) => {
                const on = v.id === selected?.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSelectedId(v.id)}
                    className={cn(
                      "h-8 shrink-0 snap-start rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors duration-200 md:h-9 md:text-sm",
                      on ? "border-forest bg-forest font-semibold text-white" : "border-khaki bg-white text-forest-text hover:border-forest",
                    )}
                  >
                    {v.title}
                  </button>
                );
              })}
            </div>

            {/* 6. Price row */}
            <div className="mt-3 min-h-[46px]" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={selected?.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-ink">{formatMoney(selected!.price)}</span>
                    {selected!.compareAtPrice && selected!.compareAtPrice.amount > selected!.price.amount && (
                      <s className="text-sm text-ink-muted">
                        <span className="sr-only">MRP </span>
                        {formatMoney(selected!.compareAtPrice)}
                      </s>
                    )}
                  </p>
                  {per && <p className="text-[13px] text-ink-muted">{per}</p>}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* 7. Add to cart */}
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!selected) return;
                await add(selected.id);
                setAdded(true);
              }}
              className="btn-shine mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-forest-mid disabled:opacity-60 md:h-11"
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
                "Add to cart"
              )}
            </button>
          </>
        ) : (
          <Link
            href={href}
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-forest px-4 text-sm font-semibold text-forest transition-colors duration-200 hover:bg-forest hover:text-white md:h-11"
          >
            Coming soon · View details
          </Link>
        )}
      </div>
    </article>
  );
}
