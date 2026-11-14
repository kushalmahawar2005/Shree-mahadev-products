"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { useCart } from "@/components/cart/CartProvider";
import { SmartImage, isPackshot } from "@/components/ui/SmartImage";
import { variantImage } from "@/lib/image-loader";
import { Pill, Rating } from "@/components/ui/primitives";
import { DISCOUNT_BADGE_MIN, discountPercent } from "@/lib/utils/money";
import { formatMoney } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import type { CardProduct } from "./cardProduct";
import { stageClass, stageImg, stageStyle } from "./cardStage";
import { defaultVariant } from "@/lib/commerce/default-variant";

export function ProductCard({ product, priority = false }: { product: CardProduct; priority?: boolean }) {
  const { add, pending } = useCart();
  const [adding, setAdding] = useState(false);
  const available = product.variants.filter((v) => v.availableForSale);
  // Admin's "Shown first" size, else the cheapest one on sale.
  const initial = defaultVariant(product, (list) =>
    list.reduce<(typeof list)[number] | undefined>((min, v) => (!min || v.price.amount < min.price.amount ? v : min), undefined),
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(initial?.id);
  const selected = product.variants.find((v) => v.id === selectedId) ?? initial;
  // Three size pills, always including the default one.
  const pills = initial && !available.slice(0, 3).includes(initial) ? [...available.slice(0, 2), initial] : available.slice(0, 3);
  const off = selected ? discountPercent(selected.price, selected.compareAtPrice) : 0;
  const unit = selected ? unitPrice(selected) : null;
  const [first, second] = product.images;
  // The photo follows the chosen size; hover crossfades to the next photo of the product.
  const img = variantImage(product.images, selected?.title) ?? first;
  const full = isPackshot(img);
  const img2 = product.images.find((im) => im.url !== img?.url) ?? (full ? undefined : second);
  const fit2 = isPackshot(img2) ? `absolute inset-0 size-full object-cover ${stageImg}` : `absolute inset-[5%] size-[90%] object-contain ${stageImg}`;
  const fit = full ? `absolute inset-0 size-full object-cover ${stageImg}` : `absolute inset-[5%] size-[90%] object-contain ${stageImg}`;
  const href = `/products/${product.handle}`;
  const badgeTag = (["bestseller", "new"] as const).find((tag) => product.tags.includes(tag));
  const badgeLabel = badgeTag === "bestseller" ? "Bestseller" : badgeTag === "new" ? "New" : null;
  const addSelected = async () => {
    if (!selected || adding) return;
    setAdding(true);
    try {
      await add(selected.id);
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(7,47,27,0.05)] transition-[box-shadow,transform] duration-300 md:hover:-translate-y-0.5 md:hover:shadow-[0_18px_34px_-22px_rgba(7,47,27,0.45)]">
      <div className="relative p-1.5 sm:p-2">
      <Link href={href} className={stageClass} style={stageStyle(product.swatch)} tabIndex={-1} aria-hidden>
        {img && (
          <SmartImage
            key={img.url}
            src={img.url}
            // Wrapper link is aria-hidden; the alt is for image search.
            alt={img.alt || product.title}
            width={img.width}
            height={img.height}
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`${fit} [transition:opacity_0.3s_ease-in-out,visibility_0.3s] ${img2 ? "pointer-fine:group-hover:invisible pointer-fine:group-hover:opacity-0" : ""}`}
          />
        )}
        {img2 && (
          <SmartImage
            src={img2.url}
            alt=""
            width={img2.width}
            height={img2.height}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className={`${fit2} invisible opacity-0 [transition:opacity_0.3s_ease-in-out,visibility_0.3s] pointer-fine:group-hover:visible pointer-fine:group-hover:opacity-100`}
          />
        )}
        {off >= DISCOUNT_BADGE_MIN && (
          <span className="absolute top-3 left-3 rounded-full bg-khaki-soft px-3 py-1 text-xs font-bold text-sale shadow-sm">{off}% off</span>
        )}
        {badgeLabel && <span className="shine-badge absolute top-3 right-3 rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-white">{badgeLabel}</span>}
      </Link>
      {/* Quick add inside the image (hover devices; touch uses the full button below). */}
      {selected && (
        <button
          type="button"
          onClick={addSelected}
          disabled={pending}
          tabIndex={-1}
          aria-hidden
          className="card-quick-add btn-slant btn-slant-light absolute inset-x-3 bottom-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold text-forest-deep shadow-[0_10px_24px_-12px_rgba(7,47,27,0.55)] disabled:opacity-70"
        >
          {adding ? <LoadingDots /> : <><Plus className="size-4" strokeWidth={2.2} /> Quick add · {selected.title}</>}
        </button>
      )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.8em] text-base leading-snug font-semibold text-forest-text sm:text-lg">
          <Link href={href} className="hover:underline">{product.title.replace(/^(Wood|Cold)-Pressed /, "")}</Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-ink-muted" lang="hi">{product.titleHi}</p>
        <Rating rating={product.rating} count={product.reviewCount} className="mt-2" />
        <p className="mt-2 line-clamp-2 min-h-[2.7em] text-sm leading-relaxed text-ink-muted">{product.shortDescription}</p>

        <div className="mt-auto pt-3">
          {pills.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Size for ${product.title}`}>
              {pills.map((v) => (
                <Pill
                  key={v.id}
                  active={v.id === selected?.id}
                  onClick={() => setSelectedId(v.id)}
                  className="min-h-8 px-3 text-xs"
                >
                  {v.title}
                </Pill>
              ))}
            </div>
          )}
          {selected ? (
            <div className="mt-3 min-h-[56px]" aria-live="polite">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {selected.compareAtPrice && selected.compareAtPrice.amount > selected.price.amount && (
                  <span className="text-xs text-ink-muted">MRP <s>{formatMoney(selected.compareAtPrice)}</s></span>
                )}
                <span className="text-2xl leading-none font-bold text-forest">{formatMoney(selected.price)}</span>
              </p>
              {unit && <p className="mt-1 text-[13px] text-ink-muted">{unit}</p>}
            </div>
          ) : (
            <div className="mt-3 min-h-[56px] text-sm font-semibold text-ink-muted">Price coming soon</div>
          )}

          {selected ? (
            <button
              type="button"
              disabled={pending}
              onClick={addSelected}
              className="btn-slant inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white disabled:opacity-60"
              aria-label={`Add ${product.title} ${selected.title} to cart`}
            >
              {adding ? <LoadingDots /> : <>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
              </svg>
              Add to cart</>}
            </button>
          ) : (
            <Link
              href={href}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-forest px-4 text-sm font-semibold text-forest hover:bg-forest hover:text-white"
            >
              View details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
