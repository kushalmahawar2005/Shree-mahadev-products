"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, ShoppingBag, Zap } from "lucide-react";
import { QtyStepper } from "@/components/cart/CartLine";
import { useCart } from "@/components/cart/CartProvider";
import { WhatsAppIcon } from "@/components/layout/icons";
import { NotifyMe } from "./NotifyMe";
import { whatsappLink } from "@/data/site";
import { flyToCart } from "@/lib/fly-to-cart";
import { formatMoney } from "@/lib/utils/money";
import { unitPrice } from "@/lib/utils/unitPrice";
import { cn } from "@/lib/utils/cn";
import type { Product, ProductVariant } from "@/lib/commerce/types";

type Props = Pick<Product, "handle" | "title" | "variants"> & { image?: string };

/** Size cards + price + qty + Add to cart / Buy now + WhatsApp, with a sticky bar once the CTA scrolls away. */
export function ProductPurchase({ handle, title, variants, image }: Props) {
  const { add, open } = useCart();
  const firstAvailable = variants.find((v) => v.availableForSale);
  // Default to the 1 L / 1 kg size if available, else first in stock.
  const preferred = variants.find((v) => v.availableForSale && v.sizeValue === 1000) ?? firstAvailable ?? variants[0];
  const [variantId, setVariantId] = useState(preferred?.id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const [added, setAdded] = useState(false);
  const variant = variants.find((v) => v.id === variantId) ?? preferred;
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!variant) return null;
  const canBuy = variant.availableForSale;
  const waMessage = `Hi, I'd like to order ${title} (${variant.title}) × ${qty}.`;

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
      <PriceBlock variant={variant} qty={qty} />

      <fieldset className="mt-6">
        <legend className="mb-2.5 text-sm font-semibold text-forest-text">
          Choose size <span className="font-normal text-ink-muted">· {variant.title}</span>
        </legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {variants.map((v) => {
            const on = v.id === variant.id;
            const off = !v.availableForSale;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVariantId(v.id);
                  setAdded(false);
                }}
                disabled={off && !v.outOfStock}
                aria-pressed={on}
                aria-label={`${v.title}${v.availableForSale ? "" : v.outOfStock ? ", out of stock" : ", price coming soon"}`}
                className={cn(
                  "relative flex flex-col items-center rounded-2xl border-2 px-2 py-2.5 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  on ? "border-forest bg-forest/[0.04] shadow-[0_8px_18px_-14px_rgba(7,47,27,0.7)]" : "border-line bg-white hover:border-forest/30",
                )}
              >
                {on && <motion.span layoutId={`size-check-${handle}`} className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-forest text-white"><Check className="size-3" strokeWidth={3} /></motion.span>}
                <span className={cn("text-sm font-bold", v.outOfStock && "line-through", on ? "text-forest" : "text-ink")}>{v.title}</span>
                <span className="mt-0.5 text-xs text-ink-muted tabular-nums">{v.outOfStock ? "Sold out" : v.price.amount ? formatMoney(v.price) : "Soon"}</span>
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
        <div ref={ctaRef} className="mt-6 space-y-3">
          <div className="flex items-center gap-3">
            <QtyStepper value={qty} min={1} onChange={setQty} label={title} disabled={!canBuy} />
            <button
              type="button"
              disabled={!canBuy || !!busy}
              onClick={addToCart}
              className="btn-shine inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-6 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-forest-mid disabled:opacity-60"
            >
              {busy === "add" ? <Loader2 className="size-4 animate-spin" /> : added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
              {!canBuy ? "Price coming soon" : added ? "Added · add more" : "Add to cart"}
            </button>
          </div>
          {canBuy && (
            <button
              type="button"
              disabled={!!busy}
              onClick={buyNow}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#e8c879] text-sm font-bold tracking-wide text-forest-deep uppercase transition-colors hover:bg-[#dfbb62] disabled:opacity-60"
            >
              {busy === "buy" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4 fill-current" />} Buy it now
            </button>
          )}
          {added && (
            <button type="button" onClick={open} className="w-full text-center text-sm font-semibold text-forest underline-offset-2 hover:underline">
              View cart
            </button>
          )}
        </div>
      )}
      <a
        href={whatsappLink(waMessage)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-forest-text hover:text-forest"
      >
        <WhatsAppIcon className="size-4 text-[#25d366]" /> Prefer WhatsApp? Order in chat
      </a>

      {/* Sticky add-to-cart once the main CTA scrolls away */}
      <AnimatePresence>
        {showSticky && canBuy && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
          >
            <div className="mx-auto flex max-w-[1360px] items-center gap-3 px-4 py-3 md:px-8">
              {image && (
                <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-[#fbf6ec] md:grid">
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
                className="btn-shine inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-forest px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy === "add" ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />} Add to cart
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={buyNow}
                className="hidden h-11 items-center rounded-full bg-[#e8c879] px-5 text-sm font-bold text-forest-deep disabled:opacity-60 sm:inline-flex"
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

function PriceBlock({ variant, qty }: { variant: ProductVariant; qty: number }) {
  const unit = unitPrice(variant);
  const save = variant.compareAtPrice ? variant.compareAtPrice.amount - variant.price.amount : 0;
  return (
    <div aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={variant.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {variant.price.amount ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-extrabold text-forest tabular-nums">{formatMoney(variant.price)}</span>
              {variant.compareAtPrice && save > 0 && (
                <>
                  <span className="text-ink-muted">
                    MRP <s>{formatMoney(variant.compareAtPrice)}</s>
                  </span>
                  <span className="rounded-full bg-forest/5 px-2.5 py-0.5 text-xs font-semibold text-forest">You save {formatMoney(save)}</span>
                </>
              )}
            </div>
          ) : (
            <p className="text-2xl font-semibold text-ink-muted">Price coming soon</p>
          )}
          <p className="mt-1 text-xs tracking-wide text-ink-muted uppercase">
            {unit ? `${unit} · ` : ""}Inclusive of all taxes
            {qty > 1 && variant.price.amount ? ` · ${qty} for ${formatMoney(variant.price.amount * qty)}` : ""}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
