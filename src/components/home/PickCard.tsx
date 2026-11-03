"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils/cn";
import { DISCOUNT_BADGE_MIN, discountPercent, formatMoney } from "@/lib/utils/money";
import type { PickProduct } from "./pickProduct";

export type { PickProduct };

/** Two Brothers-style product card: flag badge, title + price row, rating, size dropdown, full-width add button. */
export function PickCard({ product, priority = false }: { product: PickProduct; priority?: boolean }) {
  const { add, pending } = useCart();
  const available = product.variants.filter((v) => v.availableForSale);
  const [selectedId, setSelectedId] = useState(available[0]?.id);
  const selected = available.find((v) => v.id === selectedId) ?? available[0];
  const off = selected ? discountPercent(selected.price, selected.compareAtPrice) : 0;
  const href = `/products/${product.handle}`;
  const img = product.images[0];

  const badge = product.tags.includes("bestseller")
    ? { label: "Bestseller", cls: "bg-forest" }
    : off >= DISCOUNT_BADGE_MIN
      ? { label: `${off}% off`, cls: "bg-sale" }
      : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl bg-white ring-1 ring-line">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-khaki-soft" tabIndex={-1} aria-hidden>
        {img && (
          <SmartImage
            src={img.url}
            alt=""
            width={img.width}
            height={img.height}
            priority={priority}
            sizes="(min-width: 1024px) 300px, 70vw"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        )}
        {badge && (
          <span
            className={cn(
              "absolute top-0 left-0 rounded-br-xl px-3 py-1 text-xs font-semibold text-white",
              badge.cls,
            )}
          >
            {badge.label}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-[2.6em] font-body text-[15px] leading-snug font-semibold text-forest-text">
            <Link href={href} className="hover:underline">
              {product.title.replace(/^(Wood|Cold)-Pressed /, "")}
            </Link>
          </h3>
          <div className="shrink-0 text-right" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={selected?.id ?? "none"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="block"
              >
                {selected ? (
                  <>
                    <span className="block text-[15px] font-bold text-forest-text">{formatMoney(selected.price)}</span>
                    {selected.compareAtPrice && selected.compareAtPrice.amount > selected.price.amount && (
                      <s className="block text-xs text-ink-muted">
                        <span className="sr-only">MRP </span>
                        {formatMoney(selected.compareAtPrice)}
                      </s>
                    )}
                  </>
                ) : (
                  <span className="block text-xs font-semibold text-ink-muted">Coming soon</span>
                )}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
          <span lang="hi">{product.titleHi}</span> · {product.shortDescription}
        </p>

        {product.rating && product.reviewCount ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink">
            <span className="flex text-mustard" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <svg key={i} viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
                  <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
                </svg>
              ))}
            </span>
            <span className="font-semibold">{product.rating.toFixed(2)}</span>
            <span className="text-ink-muted">| {product.reviewCount} Reviews</span>
          </p>
        ) : (
          <p className="mt-1.5 min-h-[18px]" />
        )}

        <div className="mt-auto space-y-2.5 pt-3">
          {available.length > 0 ? (
            <>
              <label className="relative block">
                <span className="sr-only">Size for {product.title}</span>
                <select
                  value={selected?.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={available.length < 2}
                  className="min-h-11 w-full appearance-none rounded-lg border border-forest-text/70 bg-white pr-9 pl-3 text-sm text-ink focus:border-forest focus:outline-none disabled:opacity-100"
                >
                  {available.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-forest-text"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </label>
              <button
                type="button"
                disabled={pending || !selected}
                onClick={() => selected && add(selected.id)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-forest px-4 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-forest-mid disabled:opacity-60"
                aria-label={`Add ${product.title} ${selected?.title ?? ""} to cart`}
              >
                Add to cart
              </button>
            </>
          ) : (
            <Link
              href={href}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-forest px-4 text-sm font-bold text-forest transition-colors duration-200 hover:bg-forest hover:text-white"
            >
              View details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
