"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { SmartImage } from "@/components/ui/SmartImage";
import { buttonClass } from "@/components/ui/Button";
import { Price } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/utils/money";
import type { Product } from "@/lib/commerce/types";
import { useCart } from "./CartProvider";
import { FreeShippingBar } from "./FreeShippingBar";
import { CartLineItem } from "./CartLine";

export function CartDrawer({ upsells }: { upsells: Product[] }) {
  const { cart, isOpen, close, pending, error, add } = useCart();
  const lines = cart?.lines ?? [];
  const subtotal = cart?.subtotal.amount ?? 0;
  const inCart = new Set(lines.map((l) => l.product.handle));
  const upsell = upsells.find((p) => !inCart.has(p.handle) && p.variants.some((v) => v.availableForSale));
  const upsellVariant = upsell?.variants.find((v) => v.availableForSale);
  const isMock = cart?.checkoutUrl.startsWith("https://wa.me/");

  return (
    <Drawer open={isOpen} onClose={close} label="Your cart">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-2xl">Your cart</h2>
        <button
          type="button"
          onClick={close}
          className="grid size-11 place-items-center rounded-full text-forest hover:bg-khaki-soft"
          aria-label="Close cart"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="border-b border-line px-5 py-4">
        <FreeShippingBar subtotal={subtotal} />
      </div>

      <div className="flex-1 overflow-y-auto px-5" aria-busy={pending}>
        {lines.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-2xl text-forest-text">Your cart is empty</p>
            <p className="mt-2 text-ink-muted">Start with our everyday kachi ghani oils.</p>
            <Link href="/collections/wood-pressed-oils" onClick={close} className={buttonClass("primary", "md", "mt-6")}>
              Shop oils
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <CartLineItem key={l.id} line={l} />
            ))}
          </ul>
        )}

        {upsell && upsellVariant && lines.length > 0 && (
          <div className="my-5 rounded-[var(--radius-card)] bg-khaki-soft p-4">
            <p className="mb-3 text-sm font-semibold text-forest-text">Pairs well with</p>
            <div className="flex items-center gap-3">
              <SmartImage
                src={upsell.images[0].url}
                alt={upsell.images[0].alt}
                width={64}
                height={64}
                className="size-16 rounded-[var(--radius-img)] bg-white object-cover"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${upsell.handle}`}
                  onClick={close}
                  className="line-clamp-1 font-semibold text-forest-text hover:underline"
                >
                  {upsell.title}
                </Link>
                <p className="text-sm text-ink-muted">
                  {upsellVariant.title} · <Price price={upsellVariant.price} className="text-sm" />
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => add(upsellVariant.id)}
                className={buttonClass("secondary", "sm")}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {lines.length > 0 && cart && (
        <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="mb-2 text-sm text-sale">
              {error}
            </p>
          )}
          <div className="mb-1 flex items-center justify-between text-lg">
            <span className="font-semibold">Subtotal</span>
            <span className="font-bold text-forest-text">{formatMoney(cart.subtotal)}</span>
          </div>
          <p className="mb-4 text-sm text-ink-muted">Shipping and COD charges calculated at checkout.</p>
          <a
            href={cart.checkoutUrl}
            className={buttonClass("primary", "lg", "w-full")}
            aria-disabled={pending}
            {...(isMock ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {isMock ? "Order on WhatsApp" : "Checkout"}
          </a>
        </div>
      )}
    </Drawer>
  );
}
