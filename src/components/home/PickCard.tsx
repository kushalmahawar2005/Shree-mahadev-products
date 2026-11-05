"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Check, Loader2, Minus, Plus, ShoppingCart, Sparkles, Star } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { NotifyMe } from "@/components/product/NotifyMe";
import { NumberTicker } from "@/components/shadcn/number-ticker";
import { SmartImage } from "@/components/ui/SmartImage";
import { flyToCart } from "@/lib/fly-to-cart";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import type { PickProduct } from "./pickProduct";
import { SizeChips } from "./SizeChips";

export type { PickProduct };

const BADGES: Record<string, string> = { bestseller: "Bestseller", new: "New" };
const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed /, "");

/**
 * Product card: photo, name, rating, USP, price (counts up on size change), size chips and
 * add-to-cart. Once a size is in the cart the button becomes a − qty + stepper.
 */
export function PickCard({ product, priority = false }: { product: PickProduct; priority?: boolean }) {
  const { cart, add, update, pending } = useCart();
  // Sizes we can show: on sale, or priced but sold out (shown struck through with "Notify me").
  const available = product.variants.filter((v) => v.availableForSale || v.outOfStock);
  const [selectedId, setSelectedId] = useState((available.find((v) => v.availableForSale) ?? available[0])?.id);
  const [added, setAdded] = useState(false);
  const selected = available.find((v) => v.id === selectedId) ?? available[0];
  const href = `/products/${product.handle}`;
  const [img, img2] = product.images;
  const badgeTag = (["bestseller", "new"] as const).find((t) => product.tags.includes(t));
  // Unit price repeats the price for 100 ml / 100 g packs, so skip it there.
  const per = selected && selected.sizeValue !== 100 ? unitPrice(selected) : null;
  const save = selected?.compareAtPrice && selected.compareAtPrice.amount > selected.price.amount ? selected.compareAtPrice.amount - selected.price.amount : 0;
  const line = cart?.lines.find((l) => l.variant.id === selected?.id);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1200);
    return () => clearTimeout(t);
  }, [added]);

  const onAdd = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selected) return;
    flyToCart(e.currentTarget.closest("article")?.querySelector("[data-card-media]") ?? null, img?.url);
    await add(selected.id);
    setAdded(true);
  };

  /** Size chips + add button / stepper / notify me. Rendered in the hover panel (desktop) and inline (mobile). */
  const actions = () =>
    available.length === 0 ? (
      <Link
        href={href}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-forest px-4 text-sm font-bold tracking-wide text-forest uppercase transition-colors hover:bg-forest hover:text-white"
      >
        Coming soon · View details
      </Link>
    ) : (
      <div className="space-y-2.5">
        <SizeChips
          sizes={available.map((v) => ({ id: v.id, title: v.title, soldOut: !!v.outOfStock }))}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          label={`Size for ${product.title}`}
        />
        {selected?.outOfStock ? (
          <NotifyMe key={selected.id} variantKey={selected.id} sizeLabel={`${shortTitle(product.title)} ${selected.title}`} compact />
        ) : line && !added ? (
          <div className="flex h-11 items-center justify-between rounded-lg bg-forest text-white" aria-label={`${line.quantity} in cart`}>
            <button
              type="button"
              disabled={pending}
              onClick={() => update(line.id, line.quantity - 1)}
              className="grid h-full w-12 place-items-center rounded-l-lg transition-colors hover:bg-forest-mid disabled:opacity-60"
              aria-label="Remove one"
            >
              <Minus className="size-4" />
            </button>
            <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
              {pending ? <Loader2 className="size-4 animate-spin" /> : line.quantity}
              <span className="text-xs font-medium text-white/70">in cart</span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => update(line.id, line.quantity + 1)}
              className="grid h-full w-12 place-items-center rounded-r-lg transition-colors hover:bg-forest-mid disabled:opacity-60"
              aria-label="Add one more"
            >
              <Plus className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={onAdd}
            className="btn-shine inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-forest px-4 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-forest-mid disabled:opacity-60"
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
                {added ? <Check className="size-[18px]" strokeWidth={2.5} aria-hidden /> : <ShoppingCart className="size-[18px]" strokeWidth={2} aria-hidden />}
                {added ? "Added" : "Add to cart"}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>
    );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow duration-300 md:hover:shadow-[0_14px_30px_-22px_rgba(7,47,27,0.4)]">
      {/* 1. Photo, with the hover action panel sliding up over it (desktop) */}
      <div className="relative">
        <Link
          href={href}
          data-card-media
          className="relative block aspect-square overflow-hidden bg-[radial-gradient(70%_65%_at_50%_55%,var(--sw)_0%,#f3ead8_75%)]"
          style={{ "--sw": `${product.swatch ?? "#d0b17a"}55` } as React.CSSProperties}
          tabIndex={-1}
          aria-hidden
        >
          {img && (
            <SmartImage
              src={img.url}
              alt=""
              width={img.width}
              height={img.height}
              priority={priority}
              sizes="(min-width: 1024px) 300px, 48vw"
              className={cn(
                "absolute inset-0 size-full object-contain p-[6%] transition-[transform,opacity] duration-700 ease-[var(--ease-premium)]",
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
              sizes="(min-width: 1024px) 300px, 48vw"
              className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 md:group-hover:opacity-100"
            />
          )}
          {badgeTag && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-forest px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
              <Sparkles className="size-3 text-mustard" aria-hidden />
              {BADGES[badgeTag]}
            </span>
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {/* 2. Name + Hindi name */}
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold text-ink sm:text-base">
          <Link href={href} className="hover:text-forest hover:underline">
            {shortTitle(product.title)}
          </Link>
          <span lang="hi" className="ml-1.5 text-sm font-medium text-ink-muted">
            · {product.titleHi}
          </span>
        </h3>

        {/* 3. Stars (real reviews only) */}
        <div className="mt-1.5 h-5">
          {product.rating && product.reviewCount ? (
            <p className="flex items-center gap-1.5 text-sm" aria-label={`Rated ${product.rating.toFixed(1)} out of 5 from ${product.reviewCount} reviews`}>
              <span className="flex" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={cn("size-4", i < Math.round(product.rating!) ? "fill-[#f5b400] text-[#f5b400]" : "fill-line text-line")} />
                ))}
              </span>
              <span className="text-ink">
                {product.rating.toFixed(1)} <span className="text-ink-muted">({product.reviewCount})</span>
              </span>
            </p>
          ) : (
            <p className="text-xs font-medium text-ink-muted">New on the shelf</p>
          )}
        </div>

        {/* 4. One-line USP */}
        <p className="mt-1.5 line-clamp-2 min-h-[2.9em] text-[13px] leading-relaxed text-ink-muted">{product.shortDescription}</p>

        {/* 5. Price: counts up when the size changes */}
        {selected && (
          <div className="mt-auto pt-3" aria-live="polite">
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              {save > 0 && (
                <span className="text-sm text-ink-muted">
                  MRP: <s>{formatMoney(selected.compareAtPrice!)}</s>
                </span>
              )}
              <span className="text-[22px] leading-none font-extrabold text-forest tabular-nums">
                ₹<NumberTicker key={selected.id} value={selected.price.amount} startValue={Math.round(selected.price.amount * 0.7)} className="text-forest" />
              </span>
              {per && <span className="text-xs text-ink-muted">· {per}</span>}
              <span className="text-[11px] font-medium text-ink-muted md:ml-auto">{selected.title}</span>
            </p>
            {selected.outOfStock ? (
              <p className="mt-1 text-[12px] font-semibold text-sale">Out of stock</p>
            ) : (
              <p className="mt-1 text-[10px] tracking-wide text-ink-muted uppercase">Inclusive of all taxes</p>
            )}
          </div>
        )}

        {/* 6. Sizes + add to cart / stepper (always visible) */}
        <div className="mt-3">{actions()}</div>
      </div>
    </article>
  );
}
