"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowRight, BadgeCheck, Banknote, Loader2, Lock, Plus, ShieldCheck, ShoppingBag, TicketPercent, X } from "lucide-react";
import Image from "next/image";
import { useStoreSettings } from "@/components/StoreSettingsProvider";
import { Drawer } from "@/components/ui/Drawer";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMoney } from "@/lib/utils/money";
import type { Product } from "@/lib/commerce/types";
import { useCart } from "./CartProvider";
import { FreeShippingBar } from "./FreeShippingBar";
import { CartLineItem } from "./CartLine";

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

export function CartDrawer({ upsells }: { upsells: Product[] }) {
  const { cart, isOpen, close, pending, error, add } = useCart();
  const codEnabled = useStoreSettings().shipping.codEnabled;
  const [adding, setAdding] = useState<string | null>(null);
  const lines = cart?.lines ?? [];
  const subtotal = cart?.subtotal.amount ?? 0;
  const count = cart?.totalQuantity ?? 0;
  const savings = lines.reduce(
    (s, l) => s + (l.variant.compareAtPrice && l.variant.compareAtPrice.amount > l.variant.price.amount ? (l.variant.compareAtPrice.amount - l.variant.price.amount) * l.quantity : 0),
    0,
  );
  const inCart = new Set(lines.map((l) => l.product.handle));
  const picks = upsells
    .filter((p) => !inCart.has(p.handle))
    .map((p) => ({ p, v: p.variants.find((v) => v.availableForSale) }))
    .filter((x): x is { p: Product; v: NonNullable<typeof x.v> } => !!x.v)
    .slice(0, 3);
  const isMock = cart?.checkoutUrl.startsWith("https://wa.me/");

  return (
    <Drawer open={isOpen} onClose={close} label="Your cart">
      <div className="flex h-full flex-col bg-[#fcf9f2]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl">Your cart</h2>
            {count > 0 && <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-bold text-white tabular-nums">{count}</span>}
          </div>
          <button type="button" onClick={close} className="grid size-10 place-items-center rounded-full text-forest transition-colors hover:bg-khaki-soft" aria-label="Close cart">
            <X className="size-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="grid size-20 place-items-center rounded-full bg-khaki-soft text-forest">
              <ShoppingBag className="size-9" strokeWidth={1.5} />
            </span>
            <p className="mt-5 text-xl font-bold text-forest-text">Your cart is empty</p>
            <p className="mt-1.5 text-sm text-ink-muted">Start with our everyday kachi ghani oils.</p>
            <Link
              href="/collections/wood-pressed-oils"
              onClick={close}
              className="btn-shine mt-6 inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-forest px-7 text-sm font-bold tracking-wide text-white uppercase hover:bg-forest-mid"
            >
              Shop oils <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 pt-4" data-lenis-prevent="" aria-busy={pending}>
              <FreeShippingBar subtotal={subtotal} />

              <ul className="mt-4">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <CartLineItem key={l.id} line={l} />
                  ))}
                </AnimatePresence>
              </ul>

              {picks.length > 0 && (
                <div className="mt-2 mb-5">
                  <p className="mb-2.5 text-sm font-bold text-forest-text">Pairs well with</p>
                  <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                    {picks.map(({ p, v }) => (
                      <li key={p.handle} className="w-[150px] shrink-0 snap-start rounded-2xl border border-line bg-white p-2.5">
                        <Link href={`/products/${p.handle}`} onClick={close} className="grid h-24 place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_60%,#f3e6c8,#f6efe2_70%)]">
                          {p.images[0] && <SmartImage src={p.images[0].url} alt={p.images[0].alt} width={80} height={80} className="size-20 object-contain" />}
                        </Link>
                        <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-ink">{shortTitle(p.title)}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[13px] font-bold text-forest">
                            {formatMoney(v.price)} <span className="text-[11px] font-normal text-ink-muted">{v.title}</span>
                          </span>
                          <button
                            type="button"
                            disabled={adding === v.id}
                            onClick={async () => {
                              setAdding(v.id);
                              try {
                                await add(v.id);
                              } finally {
                                setAdding(null);
                              }
                            }}
                            className="grid size-7 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-forest-mid disabled:opacity-60"
                            aria-label={`Add ${p.title} ${v.title}`}
                          >
                            {adding === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mb-5 flex items-center gap-3 rounded-2xl bg-forest p-3.5 text-white">
                <Image
                  src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png"
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="size-12 shrink-0 rounded-full bg-white/10 p-0.5"
                />
                <p className="text-[13px] leading-snug text-white/85">
                  <strong className="block text-sm text-white">Our promise</strong>
                  Every bottle is slow-pressed in our own wooden ghani in Bijainagar.
                </p>
              </div>
            </div>

            {/* Summary + checkout */}
            {cart && (
              <div className="border-t border-line bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-20px_rgba(7,47,27,0.35)]">
                {error && (
                  <p role="alert" className="mb-2 text-sm text-sale">
                    {error}
                  </p>
                )}
                {savings > 0 && (
                  <p className="mb-2 flex items-center justify-between rounded-lg bg-forest/5 px-3 py-1.5 text-[13px] text-forest">
                    <span className="flex items-center gap-1.5 font-medium">
                      <BadgeCheck className="size-4" /> You save on MRP
                    </span>
                    <strong className="tabular-nums">{formatMoney(savings)}</strong>
                  </p>
                )}
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-ink">Subtotal</span>
                  <span className="text-xl font-extrabold text-forest tabular-nums">{formatMoney(cart.subtotal)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">Shipping{codEnabled ? " and COD charges" : ""} calculated at checkout.</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sale">
                  <TicketPercent className="size-3.5" /> Have a coupon? Apply it on the next step.
                </p>
                <a
                  href={cart.checkoutUrl}
                  className="btn-shine checkout-glow mt-3 inline-flex h-13 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-forest text-[15px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-forest-mid aria-disabled:opacity-60"
                  aria-disabled={pending}
                  {...(isMock ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  <Lock className="size-4" />
                  {isMock ? "Order on WhatsApp" : "Checkout"}
                  <ArrowRight className="size-4" />
                </a>
                <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-forest" /> Secure payment
                  </span>
                  {codEnabled && (
                    <span className="flex items-center gap-1">
                      <Banknote className="size-3.5 text-forest" /> Cash on delivery
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
