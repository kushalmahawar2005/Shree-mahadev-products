"use client";

import { cutoutUrl } from "@/lib/image-loader";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, ReceiptIndianRupee, ShoppingBag, Tag, Undo2, X } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Banknote, ShieldCheck, Truck } from "@/components/icons/duo";
import { useStoreSettings } from "@/components/StoreSettingsProvider";
import { Drawer } from "@/components/ui/Drawer";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import type { Product } from "@/lib/commerce/types";
import { previewCartCouponAction } from "@/lib/coupon-actions";
import { cartMath } from "@/lib/cart-math";
import { cartConfig } from "@/config/cart";
import type { CartLine } from "@/lib/commerce/types";
import { useCart } from "./CartProvider";
import { PaymentLogos } from "@/components/layout/PaymentLogos";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { FreeShippingBar } from "./FreeShippingBar";
import { CartLineItem } from "./CartLine";
import { defaultVariant } from "@/lib/commerce/default-variant";

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");
/** Code chosen in the cart; the checkout form reads it and applies it once the phone is entered. */
export const CART_COUPON_KEY = "smp_cart_coupon";

/** Rotating trust strip: only true, verifiable claims (src/config/cart.ts). */
const TRUST = cartConfig.trustMessages;
/** ₹1,899.00 for the order summary (₹1,899 elsewhere). */
const money2 = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const NF2 = { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

type Applied = { code: string; discount: number; freeShipping: boolean; phoneRulesPending: boolean };

/**
 * Cart drawer (Doodhvale/GoKwik-style layout, real data only): trust strip, free-shipping
 * progress, lines with size switch + MRP savings, coupon check against the live cart, add-ons,
 * and a sticky summary (saved so far, estimated total with breakdown, checkout).
 */
export function CartDrawer({ upsells, catalog = [] }: { upsells: Product[]; catalog?: Product[] }) {
  const { cart, isOpen, close, pending, error, add, lastAdded } = useCart();
  const { codEnabled, freeShippingThreshold, flatShippingFee } = useStoreSettings().shipping;
  const [adding, setAdding] = useState<string | null>(null);
  const lines = cart?.lines ?? [];
  const subtotal = cart?.subtotal.amount ?? 0;
  const count = cart?.totalQuantity ?? 0;
  // Newest first, so a just-added item shows at the top.
  const shown = [...lines].reverse();

  // Coupon: checked against the live cart on the server; re-checked whenever the cart changes.
  const [coupon, setCoupon] = useState<Applied | null>(null);
  const [code, setCode] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [checking, startCheck] = useTransition();
  const check = (raw: string, silent = false) =>
    startCheck(async () => {
      const r = await previewCartCouponAction({ code: raw });
      if (r.ok) {
        setCoupon(r);
        setCode(r.code);
        setCouponError("");
        try {
          sessionStorage.setItem(CART_COUPON_KEY, r.code);
        } catch {}
      } else {
        setCoupon(null);
        if (!silent) setCouponError(r.error);
        try {
          sessionStorage.removeItem(CART_COUPON_KEY);
        } catch {}
      }
    });
  const removeCoupon = () => {
    setCoupon(null);
    setCode("");
    try {
      sessionStorage.removeItem(CART_COUPON_KEY);
    } catch {}
  };
  // Restore a code chosen earlier in this visit, and re-price it when the cart changes.
  const cartKey = lines.map((l) => `${l.variant.id}x${l.quantity}`).join(",");
  useEffect(() => {
    if (!isOpen || !lines.length) return;
    let saved = coupon?.code ?? "";
    if (!saved) {
      try {
        saved = sessionStorage.getItem(CART_COUPON_KEY) ?? "";
      } catch {}
    }
    if (saved) check(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the cart contents or open state change
  }, [isOpen, cartKey]);

  // All the money math in one pure, unit-tested function (src/lib/cart-math.ts).
  const m = cartMath({
    lines: lines.map((l) => ({ price: l.variant.price.amount, mrp: l.variant.compareAtPrice?.amount, qty: l.quantity })),
    freeShippingThreshold,
    shippingFee: flatShippingFee,
    couponDiscount: coupon?.discount ?? 0,
    couponFreeShipping: !!coupon?.freeShipping,
    milestones: cartConfig.discountMilestones.map((d) => ({ amount: d.amount, value: d.value })),
    prepaidPercent: cartConfig.prepaidDiscountPercent,
  });
  const { mrpTotal, mrpSavings, freeShipping: freeShip, shipping, total } = m;
  const couponOff = m.couponDiscount;
  const saved = m.totalSavings;
  const [breakdown, setBreakdown] = useState(false);

  // Remove → "Removed X · Undo" for a few seconds
  const [removed, setRemoved] = useState<{ variantId: string; qty: number; name: string } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), cartConfig.undoMs);
    return () => clearTimeout(t);
  }, [removed]);
  const onRemoved = (l: CartLine) => setRemoved({ variantId: l.variant.id, qty: l.quantity, name: shortTitle(l.product.title) });

  // Trust strip rotation
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setT((n) => (n + 1) % TRUST.length), 3500);
    return () => clearInterval(id);
  }, [isOpen]);

  const inCart = new Set(lines.map((l) => l.product.handle));
  const pool = cartConfig.upsellHandles.length ? catalog.filter((p) => (cartConfig.upsellHandles as readonly string[]).includes(p.handle)) : upsells;
  const picks = pool
    .filter((p) => !inCart.has(p.handle))
    .map((p) => ({ p, v: defaultVariant(p) }))
    .filter((x): x is { p: Product; v: NonNullable<typeof x.v> } => !!x.v)
    .slice(0, 4);
  const sizesFor = (handle: string) => catalog.find((p) => p.handle === handle)?.variants ?? [];

  const isMock = cart?.checkoutUrl.startsWith("https://wa.me/");

  return (
    <Drawer open={isOpen} onClose={close} label="Your cart" className="co-theme max-w-[420px] overflow-hidden sm:rounded-l-[28px]">
      <div className="flex h-full flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between bg-white px-5 py-4">
          <h2 className="text-xl">
            Your cart{count > 0 && <span className="ml-1.5 text-base font-semibold text-ink-muted">({count} {count === 1 ? "item" : "items"})</span>}
          </h2>
          <button type="button" onClick={close} className="grid size-10 place-items-center rounded-full text-forest transition-colors hover:bg-khaki-soft" aria-label="Close cart">
            <X className="size-5" />
          </button>
        </div>

        {/* Trust strip */}
        <div className="relative z-10 flex items-center justify-between rounded-b-[18px] bg-forest px-2 py-1 text-white shadow-[0_8px_18px_-12px_rgba(7,47,27,0.6)]">
          <button type="button" aria-label="Previous" onClick={() => setT((n) => (n - 1 + TRUST.length) % TRUST.length)} className="grid size-9 place-items-center rounded-full hover:bg-white/10">
            <ChevronLeft className="size-4" strokeWidth={2.5} />
          </button>
          <div className="relative h-5 flex-1 overflow-hidden text-center text-[13px] font-bold tracking-[-0.01em]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={t} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.25 }} className="absolute inset-0 truncate">
                {TRUST[t]}
              </motion.p>
            </AnimatePresence>
          </div>
          <button type="button" aria-label="Next" onClick={() => setT((n) => (n + 1) % TRUST.length)} className="grid size-9 place-items-center rounded-full hover:bg-white/10">
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center" data-lenis-prevent="">
            <span className="grid size-20 place-items-center rounded-full bg-khaki-soft text-forest">
              <ShoppingBag className="size-9" strokeWidth={1.5} />
            </span>
            <p className="mt-5 text-xl font-bold text-forest-text">Your cart is empty</p>
            <p className="mt-1.5 text-sm text-ink-muted">Start with our everyday kachi ghani oils.</p>
            <Link
              href="/collections/wood-pressed-oils"
              onClick={close}
              className="btn-shine mt-6 inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-forest px-7 text-sm font-semibold text-white hover:bg-forest-mid"
            >
              Shop wood-pressed oils <ArrowRight className="size-4" />
            </Link>
            <div className="mt-6 w-full">
              <UndoNotice removed={removed} onUndo={async () => {
                if (!removed) return;
                const r = removed;
                setRemoved(null);
                await add(r.variantId, r.qty);
              }} />
            </div>
            {upsells.length > 0 && (
              <div className="mt-6 w-full text-left">
                <p className="mb-2 text-sm font-semibold text-forest-text">Bestsellers</p>
                <ul className="grid grid-cols-2 gap-2.5">
                  {upsells.slice(0, 4).map((p) => {
                    const v = defaultVariant(p);
                    if (!v) return null;
                    return (
                      <li key={p.handle} className="flex flex-col items-center rounded-2xl border border-line bg-white p-2.5 text-center">
                        <Link href={`/products/${p.handle}`} onClick={close} className="grid h-20 w-full place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_60%,#f3e6c8,#f6efe2_70%)]">
                          {p.images[0] && <SmartImage src={cutoutUrl(p.images[0].url)} alt={p.images[0].alt} width={72} height={72} className="size-16 object-contain" />}
                        </Link>
                        <p className="mt-1.5 line-clamp-1 text-[13px] font-semibold text-ink">{shortTitle(p.title)}</p>
                        <p className="text-xs font-bold text-forest tabular-nums">{formatMoney(v.price)}</p>
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
                          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1 rounded-full border border-forest/25 text-xs font-semibold text-forest hover:bg-forest hover:text-white disabled:opacity-60"
                        >
                          {adding === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add · {v.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6" data-lenis-prevent="" aria-busy={pending}>
              <FreeShippingBar subtotal={subtotal} />

              <ul className="mt-4">
                <AnimatePresence initial={false}>
                  {shown.map((l) => (
                    <CartLineItem
                      key={l.id}
                      line={l}
                      sizes={sizesFor(l.product.handle)}
                      flash={lastAdded?.variantId === l.variant.id ? lastAdded.tick : 0}
                      onRemoved={onRemoved}
                    />
                  ))}
                </AnimatePresence>
              </ul>
              <UndoNotice removed={removed} onUndo={async () => {
                if (!removed) return;
                const r = removed;
                setRemoved(null);
                await add(r.variantId, r.qty);
              }} />

              {/* Coupon */}
              <div className="rounded-2xl border border-line bg-white p-3.5">
                {coupon ? (
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest/10 text-forest">
                      <Tag className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold tracking-wide text-forest-text">{coupon.code} applied</p>
                      <p className="text-xs text-co-success">
                        {coupon.freeShipping ? "Free shipping on this order" : `You save ${formatMoney(coupon.discount)}`}
                        {coupon.phoneRulesPending && <span className="text-ink-muted"> · final check at checkout</span>}
                      </p>
                    </div>
                    <button type="button" onClick={removeCoupon} className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-alert hover:underline">
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => setCouponOpen((o) => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={couponOpen}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest/10 text-forest">
                        <Tag className="size-4" />
                      </span>
                      <span className="flex-1 text-sm font-semibold text-forest-text">Have a coupon code?</span>
                      <ChevronDown className={cn("size-4 text-ink-muted transition-transform", couponOpen && "rotate-180")} />
                    </button>
                    <AnimatePresence initial={false}>
                      {couponOpen && (
                        <motion.form
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (code.trim()) check(code.trim());
                          }}
                        >
                          <div className="mt-3 flex gap-2">
                            <input
                              value={code}
                              onChange={(e) => {
                                setCode(e.target.value.toUpperCase());
                                setCouponError("");
                              }}
                              placeholder="Enter code"
                              aria-label="Coupon code"
                              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm font-semibold tracking-wide uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:normal-case focus:border-forest"
                            />
                            <button type="submit" disabled={checking || !code.trim()} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">
                              {checking && <Loader2 className="size-4 animate-spin" />} Apply
                            </button>
                          </div>
                          {couponError && (
                            <p role="alert" className="mt-2 text-xs text-alert">
                              {couponError}
                            </p>
                          )}
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              {/* Add-ons at their real prices */}
              {picks.length > 0 && (
                <div className="mt-4 rounded-2xl border border-line bg-white p-3.5">
                  <p className="mb-3 text-[15px] font-bold text-forest-text">You may also like</p>
                  <ul className="no-scrollbar -mx-3.5 flex snap-x gap-2.5 overflow-x-auto px-3.5 pb-1">
                    {picks.map(({ p, v }) => {
                      const mrp = v.compareAtPrice && v.compareAtPrice.amount > v.price.amount ? v.compareAtPrice.amount : 0;
                      const off = mrp ? Math.round(((mrp - v.price.amount) / mrp) * 100) : 0;
                      return (
                        <li key={p.handle} className="flex w-[190px] shrink-0 snap-start gap-2.5 rounded-xl border border-line p-2.5">
                          <Link href={`/products/${p.handle}`} onClick={close} className="relative grid size-16 shrink-0 place-items-center rounded-lg bg-[radial-gradient(circle_at_50%_60%,#f3e6c8,#f6efe2_70%)]">
                            {p.images[0] && <SmartImage src={cutoutUrl(p.images[0].url)} alt={p.images[0].alt} width={64} height={64} className="size-14 object-contain" />}
                            {off > 0 && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-co-success px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-white">{off}% off</span>}
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-ink">{shortTitle(p.title)}</p>
                            <p className="mt-0.5 text-[13px] font-bold text-forest tabular-nums">
                              {formatMoney(v.price)} {mrp > 0 && <s className="text-[11px] font-normal text-ink-muted">{formatMoney(mrp)}</s>}
                            </p>
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
                              className="mt-auto inline-flex h-9 items-center justify-center gap-1 rounded-full border border-forest/25 text-xs font-semibold text-forest transition-colors hover:bg-forest hover:text-white disabled:opacity-60"
                              aria-label={`Add ${p.title} ${v.title}`}
                            >
                              {adding === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add · {v.title}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Sticky summary */}
            {cart && (
              <div className="relative rounded-t-[24px] border-t border-line bg-white px-4 pt-5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-14px_30px_-18px_rgba(7,47,27,0.3)]">
                {saved > 0 && <SavedRibbon value={saved} />}
                {error && (
                  <p role="alert" className="mb-2 text-sm text-sale">
                    {error}
                  </p>
                )}

                <button type="button" onClick={() => setBreakdown((b) => !b)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={breakdown}>
                  <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-bold whitespace-nowrap text-forest-text">
                    <ReceiptIndianRupee className="size-5 text-forest" strokeWidth={1.8} aria-hidden />
                    Estimated total
                    <ChevronDown className={cn("size-4 text-ink-muted transition-transform", breakdown && "rotate-180")} />
                  </span>
                  <span className="min-w-0 text-right leading-tight">
                    <span className="flex items-baseline justify-end gap-1.5">
                      {/* struck "was" price on the same basis as the total (MRP + this shipping) */}
                      {mrpTotal + shipping > total && <s className="text-xs text-ink-muted tabular-nums">{money2(mrpTotal + shipping)}</s>}
                      <span className="text-xl font-extrabold whitespace-nowrap text-forest-text tabular-nums" aria-live="polite">
                        <NumberFlow value={total} format={NF2} locales="en-IN" />
                      </span>
                    </span>
                    {m.percentOff > 0 && <span className="block text-xs font-bold text-co-success">({m.percentOff}% OFF)</span>}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {breakdown && (
                    <motion.dl initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-[13px]">
                      <div className="mt-2 space-y-1.5 rounded-xl bg-[#f7f3ea] p-3">
                        <Row label="MRP total" value={money2(mrpTotal)} />
                        {mrpSavings > 0 && <Row label="Discount on MRP" value={`− ${money2(mrpSavings)}`} good />}
                        {m.milestoneDiscount > 0 && <Row label="Offer discount" value={`− ${money2(m.milestoneDiscount)}`} good />}
                        {couponOff > 0 && <Row label={`Coupon ${coupon?.code}`} value={`− ${money2(couponOff)}`} good />}
                        {m.prepaidDiscount > 0 && <Row label="Prepaid discount" value={`− ${money2(m.prepaidDiscount)}`} good />}
                        <Row label="Shipping" value={freeShip ? "FREE" : money2(shipping)} good={freeShip} />
                        {saved > 0 && <Row label="Total savings" value={money2(saved)} good />}
                        <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                          <dt className="text-ink">Estimated total</dt>
                          <dd className="text-forest tabular-nums">{money2(total)}</dd>
                        </div>
                        {codEnabled && <p className="text-[11px] text-ink-muted">COD charges, if any, are added at checkout.</p>}
                      </div>
                    </motion.dl>
                  )}
                </AnimatePresence>

                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Chip>
                    <Truck className="size-3.5" />
                    {freeShip ? "FREE shipping included" : `${formatMoney(freeShippingThreshold - m.subtotal)} more for free shipping`}
                  </Chip>
                  {cartConfig.prepaidDiscountPercent > 0 && <Chip>Extra {cartConfig.prepaidDiscountPercent}% off on prepaid</Chip>}
                  {codEnabled && (
                    <Chip>
                      <Banknote className="size-3.5" /> COD available
                    </Chip>
                  )}
                </div>

                <Button asChild className="btn-shine checkout-glow mt-2.5 h-12 w-full justify-between rounded-full bg-forest pr-2 pl-5 text-white hover:bg-forest-mid aria-disabled:opacity-60">
                  <a href={cart.checkoutUrl} aria-disabled={pending} {...(isMock ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    <span className="flex items-center gap-1.5 text-base font-bold">
                      {isMock ? "Order on WhatsApp" : "Checkout"} <ArrowRight className="size-4" />
                    </span>
                    {/* overlapping round payment marks */}
                    <span className="flex items-center pr-1 [&_li]:-ml-1.5 [&_li]:size-8 [&_li]:min-w-0 [&_li]:overflow-hidden [&_li]:rounded-full [&_li]:p-1 [&_li]:ring-2 [&_li]:ring-forest [&_li:first-child]:ml-0 [&_svg]:!h-2.5 [&_svg]:max-w-[22px]">
                      <PaymentLogos size="sm" only={["Google Pay", "PhonePe", "Paytm"]} />
                    </span>
                  </a>
                </Button>
                <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
                  <ShieldCheck className="size-3.5 text-forest" /> UPI · Cards{codEnabled ? " · COD" : ""} · Secured by <PayULogo />
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

function Row({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", good ? "text-co-success" : "text-ink")}>{value}</dd>
    </div>
  );
}

/** "Removed X · Undo" (auto-hides after cartConfig.undoMs). */
function UndoNotice({ removed, onUndo }: { removed: { name: string } | null; onUndo: () => void }) {
  return (
    <AnimatePresence>
      {removed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
          role="status"
        >
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-co-success/10 px-3 py-2 text-[13px] text-co-success">
            <span>
              Removed <strong>{removed.name}</strong>
            </span>
            <button type="button" onClick={onUndo} className="inline-flex h-9 items-center gap-1 rounded-full px-3 font-semibold hover:bg-co-success/10">
              <Undo2 className="size-4" /> Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className="h-6 gap-1 rounded-md border-0 bg-co-success/8 px-2 text-[11px] font-semibold text-co-success [&>svg]:size-3.5">
      {children}
    </Badge>
  );
}

/** Ribbon across the top of the summary: "₹476.00 Saved so far!" with folded ends (wide, centred). */
function SavedRibbon({ value }: { value: number }) {
  return (
    // Centring lives on this static wrapper; the motion element below owns `transform` (y), so a
    // translate-x on it would be overwritten.
    <div className="pointer-events-none absolute inset-x-0 -top-3.5 flex justify-center" aria-live="polite">
      <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative w-[84%]">
        {/* folded ends, tucked behind and slightly lower */}
        <span aria-hidden className="absolute top-1.5 -left-2 h-full w-5 rounded-l-md bg-[#145c34]" />
        <span aria-hidden className="absolute top-1.5 -right-2 h-full w-5 rounded-r-md bg-[#145c34]" />
        <span className="relative block rounded-md bg-co-success py-1 text-center text-[13px] font-bold text-white shadow-[0_6px_14px_-8px_rgba(7,47,27,0.6)] tabular-nums">
          <NumberFlow value={value} format={NF2} locales="en-IN" /> Saved so far!
        </span>
      </motion.div>
    </div>
  );
}

/** PayU wordmark (hand-rolled SVG in PayU green; no official asset in the repo). */
export function PayULogo() {
  return (
    <svg viewBox="0 0 46 16" className="h-3.5 w-auto" role="img" aria-label="PayU">
      <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontSize="15" fontWeight="800" fill="#7FB100" letterSpacing="-0.3">
        PayU
      </text>
    </svg>
  );
}
