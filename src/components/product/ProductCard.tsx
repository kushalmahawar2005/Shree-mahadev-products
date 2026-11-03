"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { Badge, Pill, Price, Rating, SwatchDot } from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";
import { DISCOUNT_BADGE_MIN, discountPercent } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import type { CardProduct } from "./cardProduct";

export function ProductCard({ product, priority = false }: { product: CardProduct; priority?: boolean }) {
  const { add, pending } = useCart();
  const available = product.variants.filter((v) => v.availableForSale);
  const cheapest = available.reduce<(typeof available)[number] | undefined>(
    (min, v) => (!min || v.price.amount < min.price.amount ? v : min),
    undefined,
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(cheapest?.id);
  const selected = product.variants.find((v) => v.id === selectedId) ?? cheapest;
  const pills = available.slice(0, 3);
  const off = selected ? discountPercent(selected.price, selected.compareAtPrice) : 0;
  const unit = selected ? unitPrice(selected) : null;
  const [img, img2] = product.images;
  const href = `/products/${product.handle}`;

  return (
    <article className="group relative flex h-full flex-col">
      <Link href={href} className="relative block overflow-hidden rounded-[var(--radius-card)] bg-khaki-soft" tabIndex={-1} aria-hidden>
        <div className="aspect-square">
          {img && (
            <SmartImage
              src={img.url}
              alt=""
              width={img.width}
              height={img.height}
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={cn(
                "size-full object-cover transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.04]",
                img2 && "group-hover:opacity-0",
              )}
            />
          )}
          {img2 && (
            <SmartImage
              src={img2.url}
              alt=""
              width={img2.width}
              height={img2.height}
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="absolute inset-0 size-full object-cover opacity-0 transition-[transform,opacity] duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
            />
          )}
        </div>
        {off >= DISCOUNT_BADGE_MIN && (
          <Badge className="absolute top-3 left-3">{off}% off</Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col pt-3">
        <div className="flex items-start gap-2">
          <SwatchDot color={product.swatch} className="mt-1.5" />
          <div className="min-w-0">
            <h3 className="font-body text-base leading-snug font-semibold text-forest-text">
              <Link href={href} className="hover:underline">
                {product.title}
              </Link>
            </h3>
            <p className="text-sm text-ink-muted" lang="hi">
              {product.titleHi}
            </p>
          </div>
        </div>

        <Rating rating={product.rating} count={product.reviewCount} className="mt-1.5" />

        <div className="mt-2">
          {selected ? (
            <Price
              price={selected.price}
              compareAt={selected.compareAtPrice}
              from={selected.id === cheapest?.id && available.length > 1}
            />
          ) : (
            <span className="text-sm font-semibold text-ink-muted">Price coming soon</span>
          )}
          {unit && <p className="text-sm text-ink-muted">{unit}</p>}
        </div>

        {pills.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Size for ${product.title}`}>
            {pills.map((v) => (
              <Pill
                key={v.id}
                active={v.id === selected?.id}
                onClick={() => setSelectedId(v.id)}
                className="min-h-9 px-3 text-xs"
              >
                {v.title}
              </Pill>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          {selected ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => add(selected.id)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-forest px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-forest-mid disabled:opacity-60"
              aria-label={`Add ${product.title} ${selected.title} to cart`}
            >
              Add to cart
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
