"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { QtyStepper } from "@/components/cart/CartLine";
import { useCart } from "@/components/cart/CartProvider";
import { WhatsAppIcon } from "@/components/layout/icons";
import { NotifyMe } from "./NotifyMe";
import { Badge, Pill } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/Button";
import { site, whatsappLink } from "@/data/site";
import { DISCOUNT_BADGE_MIN, discountPercent, formatMoney } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import type { Product, ProductVariant } from "@/lib/commerce/types";

type Props = Pick<Product, "handle" | "title" | "variants">;

/** VariantPicker + PriceBlock + AddToCart + sticky mobile ATC. */
export function ProductPurchase({ handle, title, variants }: Props) {
  const { add, pending } = useCart();
  const firstAvailable = variants.find((v) => v.availableForSale);
  // Default to the 1L / most common size if available, else first in stock.
  const preferred =
    variants.find((v) => v.availableForSale && v.sizeValue === 1000) ?? firstAvailable ?? variants[0];
  const [variantId, setVariantId] = useState(preferred?.id);
  const [qty, setQty] = useState(1);
  const variant = variants.find((v) => v.id === variantId) ?? preferred;
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!variant) return null;
  const canBuy = variant.availableForSale;
  const waMessage = `Hi, I'd like to order ${title} (${variant.title}) × ${qty}.`;

  return (
    <div>
      <PriceBlock variant={variant} />

      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold text-forest-text">
          Size: <span className="font-normal text-ink-muted">{variant.title}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <Pill
              key={v.id}
              active={v.id === variant.id}
              disabled={!v.availableForSale && !v.outOfStock}
              onClick={() => setVariantId(v.id)}
              aria-label={`${v.title}${v.availableForSale ? "" : v.outOfStock ? ", out of stock" : ", price coming soon"}`}
              className={v.outOfStock ? "line-through" : undefined}
            >
              {v.title}
            </Pill>
          ))}
        </div>
      </fieldset>

      {variant.outOfStock ? (
        <div ref={ctaRef} className="mt-6">
          <p className="mb-2 font-semibold text-sale">Out of stock</p>
          <NotifyMe key={variant.id} variantKey={variant.id} sizeLabel={`${title} ${variant.title}`} />
        </div>
      ) : (
        <div ref={ctaRef} className="mt-6 flex flex-wrap items-center gap-3">
          <QtyStepper value={qty} min={1} onChange={setQty} label={title} disabled={!canBuy} />
          <button
            type="button"
            disabled={!canBuy || pending}
            onClick={() => add(variant.id, qty)}
            className={buttonClass("primary", "lg", "btn-shine flex-1")}
          >
            {canBuy ? "Add to cart" : "Price coming soon"}
          </button>
        </div>
      )}
      <a
        href={whatsappLink(waMessage)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("secondary", "lg", "mt-3 w-full")}
      >
        <WhatsAppIcon className="size-5" /> Buy on WhatsApp
      </a>

      <ul className="mt-5 space-y-1 text-sm text-ink-muted">
        <li>Free shipping on orders above {formatMoney(site.freeShippingThreshold)}.</li>
        <li>Cash on delivery available. {/* TODO(client): COD charges + delivery time by state */}</li>
        <li>Ships from Bijainagar, Rajasthan. Delivery time: TODO(client).</li>
      </ul>

      {/* Sticky add-to-cart on mobile, sits above the bottom bar */}
      <AnimatePresence>
        {showSticky && canBuy && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-3 md:hidden"
            data-handle={handle}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-forest-text">{variant.title}</p>
              <p className="font-bold text-forest-text">{formatMoney(variant.price)}</p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => add(variant.id, qty)}
              className={buttonClass("primary", "md", "btn-shine")}
            >
              Add to cart
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PriceBlock({ variant }: { variant: ProductVariant }) {
  const off = discountPercent(variant.price, variant.compareAtPrice);
  const unit = unitPrice(variant);
  return (
    <div aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={variant.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {variant.price.amount ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold text-forest-text">{formatMoney(variant.price)}</span>
              {variant.compareAtPrice && (
                <span className="text-ink-muted">
                  MRP <s>{formatMoney(variant.compareAtPrice)}</s>
                </span>
              )}
              {off >= DISCOUNT_BADGE_MIN && <Badge>{off}% off</Badge>}
            </div>
          ) : (
            <p className="text-2xl font-semibold text-ink-muted">Price coming soon</p>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            {unit ? `${unit} · ` : ""}Inclusive of all taxes
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
