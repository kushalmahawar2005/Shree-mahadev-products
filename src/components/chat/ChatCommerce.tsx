"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, LoaderCircle, Minus, Plus, ShoppingBag, Undo2 } from "lucide-react";
import { ease, enter, rise, small, staggerParent } from "@/components/chat/motion";
import { useCart } from "@/components/cart/CartProvider";
import { useStoreSettings } from "@/components/StoreSettingsProvider";

export type ChatVariant = { id: string; title: string; price: number; compareAt?: number; available: boolean };
export type ShopProduct = {
  handle: string; title: string; titleHi?: string; category?: string; href: string; image: string | null;
  price: number; inStock: boolean; variants: ChatVariant[]; defaultSize?: string;
  benefit?: string; popular?: string[]; trust?: string;
};
export type CartIntent = { action: "add"; product: ShopProduct; variantId: string | null; qty: number; done?: boolean } | { action: "cart" } | { action: "checkout" };

const rupee = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const spring = { type: "spring", stiffness: 380, damping: 32 } as const;
const press = { type: "spring", stiffness: 500, damping: 30 } as const;
/** Chat actions already run, so React dev double-effects or re-renders never add twice. */
const ranActions = new Set<string>();

function firstAvailable(product: ShopProduct) {
  const preferred = product.variants.find((variant) => variant.available && variant.title === product.defaultSize);
  return preferred ?? product.variants.find((variant) => variant.available) ?? product.variants[0];
}

function SizeChips({ product, value, onChange }: { product: ShopProduct; value: string; onChange: (id: string) => void }) {
  if (product.variants.length < 2) return null;
  return (
    <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={`${product.title} size`}>
      {product.variants.map((variant) => (
        <button
          key={variant.id}
          type="button"
          role="radio"
          aria-checked={variant.id === value}
          disabled={!variant.available}
          onClick={() => onChange(variant.id)}
          className={`flex flex-col items-center rounded-lg border px-1 py-1 leading-tight transition disabled:cursor-not-allowed disabled:opacity-40 ${variant.id === value ? "border-forest bg-forest text-white shadow-sm" : "border-line bg-white text-ink hover:border-forest/40"}`}
        >
          <span className="text-[11px] font-semibold">{variant.title}</span>
          <span className={`text-[11px] tabular-nums ${variant.id === value ? "text-white/80" : "text-ink-muted"}`}>{variant.available ? rupee(variant.price) : "Sold out"}</span>
        </button>
      ))}
    </div>
  );
}

/** Price with MRP strike-through and % off, only when the store has a real compare-at price. */
function Price({ variant, className = "" }: { variant: ChatVariant; className?: string }) {
  const off = variant.compareAt ? Math.round((1 - variant.price / variant.compareAt) * 100) : 0;
  return (
    <span className={`flex items-baseline gap-1.5 ${className}`}>
      <span className="whitespace-nowrap text-[17px] font-semibold tabular-nums text-ink">{rupee(variant.price)}</span>
      {variant.compareAt && off > 0 && (
        <>
          <span className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-muted line-through">{rupee(variant.compareAt)}</span>
          <span className="whitespace-nowrap text-[12px] font-semibold text-emerald-700">{off}% off</span>
        </>
      )}
    </span>
  );
}

/** Add pill that becomes a − qty + stepper once this size is in the cart. */
function AddControl({ variant, label }: { variant: ChatVariant | undefined; label: string }) {
  const { add, update, remove, cart, pending } = useCart();
  const [adding, setAdding] = useState(false);
  const line = variant ? cart?.lines.find((item) => item.variant.id === variant.id) : undefined;

  if (!variant?.available) {
    return <span className="grid h-9 place-items-center rounded-full bg-co-panel px-4 text-[13px] font-semibold text-ink-muted">Sold out</span>;
  }
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {line ? (
        <motion.div key="stepper" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1, transition: press }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12, ease: ease.inQuart } }} className="flex h-9 items-center rounded-full bg-forest text-white">
          <button type="button" aria-label={`One less ${label}`} disabled={pending} onClick={() => void (line.quantity > 1 ? update(line.id, line.quantity - 1) : remove(line.id))} className="relative grid h-9 w-9 place-items-center rounded-full after:absolute after:-inset-1 hover:bg-white/10"><Minus size={15} /></button>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={line.quantity} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: small }} exit={{ y: -8, opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }} className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">{line.quantity}</motion.span>
          </AnimatePresence>
          <button type="button" aria-label={`One more ${label}`} disabled={pending || line.quantity >= 10} onClick={() => void update(line.id, line.quantity + 1)} className="relative grid h-9 w-9 place-items-center rounded-full after:absolute after:-inset-1 hover:bg-white/10 disabled:opacity-40"><Plus size={15} /></button>
        </motion.div>
      ) : (
        <motion.button
          key="add"
          layout
          type="button"
          whileTap={{ scale: 0.97, transition: press }}
          disabled={adding}
          onClick={async () => { setAdding(true); await add(variant.id, 1, { silent: true }); setAdding(false); }}
          aria-label={`Add ${label} to cart`}
          className="relative flex h-9 items-center gap-1 rounded-full bg-forest px-4 text-sm font-semibold text-white transition-colors after:absolute after:-inset-1 hover:bg-forest-mid disabled:opacity-70"
        >
          {adding ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}Add
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact product card (default in chat and the Shop tab): 72px thumb, names, a benefit line from
 * product data, the 3 most-bought sizes (+N expands), price and Add/stepper. Tapping the photo or
 * name expands it in place into the detailed view.
 */
export function ShopCard({ product, index = 0 }: { product: ShopProduct; index?: number; fluid?: boolean }) {
  const ordered = (product.popular?.length ? product.popular.map((id) => product.variants.find((variant) => variant.id === id)).filter(Boolean) as ChatVariant[] : product.variants);
  const [variantId, setVariantId] = useState(() => (ordered.find((variant) => variant.available) ?? ordered[0])?.id ?? "");
  const [allSizes, setAllSizes] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const variant = product.variants.find((item) => item.id === variantId);
  const visible = expanded || allSizes ? product.variants : ordered.slice(0, 3);
  const hidden = product.variants.length - visible.length;
  const label = `${product.title}${variant ? ` ${variant.title}` : ""}`;

  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: enter(index * 0.06) }} transition={{ layout: { duration: 0.32, ease: ease.inOutCubic } }} className="w-full overflow-hidden rounded-xl border border-[#eadfca] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      {/* The photo stays a small thumb; expanding only reveals sizes, trust line and the page link. */}
      <motion.div layout="position" className="flex gap-3">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? `Collapse ${product.title}` : `Show details of ${product.title}`} className="relative size-[72px] shrink-0 overflow-hidden rounded-[10px] bg-[#fbf3e3]">
          {product.image && <Image src={product.image} alt={product.title} fill sizes="72px" className="object-contain p-1" />}
          {!product.inStock && <span className="absolute left-1 top-1 rounded-full bg-white/95 px-1.5 text-[11px] font-semibold text-alert">Sold out</span>}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setExpanded((value) => !value)} className="block w-full min-w-0 text-left">
            <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{product.title}</span>
            {product.titleHi && <span className="font-hindi block truncate py-px text-[13px] leading-normal text-ink-muted">{product.titleHi}</span>}
          </button>
          {product.benefit && <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{product.benefit}</p>}

          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${product.title} size`}>
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={item.id === variantId}
                disabled={!item.available}
                onClick={() => setVariantId(item.id)}
                className={`relative h-8 rounded-full border px-3 text-[13px] font-medium transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${item.id === variantId ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-forest/40"}`}
              >
                {item.title}
              </button>
            ))}
            {hidden > 0 && (
              <button type="button" onClick={() => setAllSizes(true)} aria-label={`Show ${hidden} more sizes`} className="relative h-8 rounded-full border border-dashed border-line px-2.5 text-[13px] font-medium text-ink-muted after:absolute after:-inset-y-1.5 after:inset-x-0 hover:text-forest">+{hidden}</button>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            {variant ? <Price variant={variant} /> : <span />}
            <AddControl variant={variant} label={label} />
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter(0.05) }} exit={{ opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }} className="mt-2.5 space-y-2 border-t border-line pt-2.5">
                {product.trust && <p className="text-[12.5px] font-medium text-forest">{product.trust}</p>}
                <div className="flex items-center justify-between">
                  <Link href={product.href} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-forest underline-offset-2 hover:underline">Poora page dekhein<ArrowUpRight size={14} /></Link>
                  <button type="button" onClick={() => setExpanded(false)} className="inline-flex min-h-11 items-center gap-1 text-[13px] text-ink-muted">Kam dikhayein<ChevronDown size={14} className="rotate-180" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.article>
  );
}

/** Chat replies: up to 3 cards stacked; 4+ become a peeking, snapping carousel with an edge fade. */
export function ShopCards({ items }: { items: ShopProduct[] }) {
  if (!items.length) return null;
  if (items.length <= 3) {
    return (
      <motion.div initial="hidden" animate="show" variants={staggerParent(0.06)} className="mt-2 space-y-2">
        {items.map((item, index) => <motion.div key={item.href} variants={rise}><ShopCard product={item} index={index} /></motion.div>)}
      </motion.div>
    );
  }
  return (
    <div className="relative mt-2">
      <div className="-mr-3.5 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pr-3.5 [scrollbar-width:none]">
        {items.map((item, index) => <div key={item.href} className="w-[85%] shrink-0 snap-start"><ShopCard product={item} index={index} /></div>)}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 -right-3.5 w-8 bg-gradient-to-l from-ivory to-transparent" />
    </div>
  );
}

function CheckoutButton({ label = "Checkout karein" }: { label?: string }) {
  return (
    <Link href="/checkout" className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-forest text-sm font-semibold text-white transition hover:bg-forest-mid">
      {label}<ArrowRight size={15} />
    </Link>
  );
}

function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const threshold = useStoreSettings().shipping.freeShippingThreshold;
  if (!threshold) return null;
  const left = Math.max(0, threshold - subtotal);
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-ink-muted">{left ? <>Sirf <strong className="text-forest">{rupee(left)}</strong> aur, phir shipping free 🚚</> : <strong className="text-forest">Free shipping unlocked 🎉</strong>}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-co-panel">
        <motion.div className="h-full rounded-full bg-forest" initial={{ width: 0 }} animate={{ width: `${threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  );
}

/** Live cart summary (what the shopper has right now) with checkout. */
export function CartCard({ title = "Aapka cart" }: { title?: string }) {
  const { cart, open } = useCart();
  const lines = cart?.lines ?? [];
  if (!lines.length) {
    return (
      <div className="rounded-2xl border border-line bg-white p-3.5 text-sm text-ink-muted">
        <p className="flex items-center gap-2 font-semibold text-ink"><ShoppingBag size={16} className="text-forest" />Cart abhi khaali hai</p>
        <p className="mt-1">Koi product pasand aaye toh bataiye, main yahin add kar dunga.</p>
      </div>
    );
  }
  const subtotal = Number(cart?.subtotal.amount ?? 0);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-3 rounded-2xl border border-line bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <p className="flex items-center justify-between text-sm font-semibold text-ink"><span className="flex items-center gap-2"><ShoppingBag size={16} className="text-forest" />{title}</span><span className="text-xs font-medium text-ink-muted">{cart?.totalQuantity} item{cart?.totalQuantity === 1 ? "" : "s"}</span></p>
      <ul className="space-y-2">
        {lines.slice(0, 4).map((line) => (
          <li key={line.id} className="flex items-center gap-2.5">
            <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-[#fbf3e3]">{line.product.images[0] && <Image src={line.product.images[0].url} alt="" fill sizes="44px" className="object-cover" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{line.product.title}</span><span className="text-[11px] text-ink-muted">{line.variant.title} × {line.quantity}</span></span>
            <span className="text-xs font-semibold tabular-nums text-ink">{rupee(Number(line.variant.price.amount) * line.quantity)}</span>
          </li>
        ))}
        {lines.length > 4 && <li className="text-[11px] text-ink-muted">+{lines.length - 4} aur item</li>}
      </ul>
      <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm"><span className="text-ink-muted">Subtotal</span><span className="font-bold tabular-nums text-forest">{rupee(subtotal)}</span></div>
      <FreeShippingBar subtotal={subtotal} />
      <div className="flex gap-2">
        <button type="button" onClick={open} className="h-10 rounded-xl border border-line px-3 text-sm font-semibold text-forest transition hover:bg-co-brand-soft">Cart kholein</button>
        <CheckoutButton />
      </div>
      <p className="text-center text-[11px] text-ink-muted">Address aur payment secure checkout page par hote hain.</p>
    </motion.div>
  );
}

/** "Add X to cart" from a chat message: adds once, confirms, offers undo and checkout. Without a size it asks for one first. */
export function AddToCartCard({ intent, actionKey }: { intent: Extract<CartIntent, { action: "add" }>; actionKey: string }) {
  const { add, update, remove, cart } = useCart();
  const { product } = intent;
  const [variantId, setVariantId] = useState(intent.variantId ?? firstAvailable(product)?.id ?? "");
  const [qty, setQty] = useState(intent.qty);
  // Re-mounts (scroll, re-render) of an action that already ran show it as added, not re-add.
  const [state, setState] = useState<"choose" | "adding" | "added" | "undone">(() => (!intent.variantId ? "choose" : ranActions.has(actionKey) || intent.done ? "added" : "adding"));
  const variant = product.variants.find((item) => item.id === variantId);

  async function doAdd(id: string, quantity: number) {
    setState("adding");
    await add(id, quantity, { silent: true });
    setState("added");
  }

  useEffect(() => {
    if (!intent.variantId || intent.done || ranActions.has(actionKey)) return;
    ranActions.add(actionKey);
    void add(intent.variantId, intent.qty, { silent: true }).then(() => setState("added"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per chat action
  }, [actionKey]);

  async function undo() {
    const line = cart?.lines.find((item) => item.variant.id === variantId);
    if (!line) return setState("undone");
    if (line.quantity > qty) await update(line.id, line.quantity - qty);
    else await remove(line.id);
    setState("undone");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} className="space-y-3 rounded-2xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <div className="flex gap-3">
        <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[#fbf3e3]">{product.image && <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />}</span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{product.title}</p>
          {variant && <p className="mt-0.5 text-xs text-ink-muted">{variant.title} × {qty} · <strong className="text-forest">{rupee(variant.price * qty)}</strong></p>}
          <AnimatePresence mode="wait">
            {state === "adding" && <motion.p key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1 flex items-center gap-1 text-xs text-ink-muted"><LoaderCircle size={12} className="animate-spin" />Cart mein daal raha hoon…</motion.p>}
            {state === "added" && <motion.p key="b" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="grid size-4 place-items-center rounded-full bg-emerald-600 text-white"><Check size={10} /></motion.span>Cart mein add ho gaya</motion.p>}
            {state === "undone" && <motion.p key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-xs text-ink-muted">Hata diya.</motion.p>}
          </AnimatePresence>
        </div>
      </div>

      {state === "choose" && (
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-ink">Size chuniye</p>
          <SizeChips product={product} value={variantId} onChange={setVariantId} />
          <div className="flex items-center gap-2">
            <div className="flex h-10 items-center rounded-xl border border-line">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQty((value) => Math.max(1, value - 1))} className="grid size-10 place-items-center text-forest"><Minus size={14} /></button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQty((value) => Math.min(10, value + 1))} className="grid size-10 place-items-center text-forest"><Plus size={14} /></button>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} type="button" disabled={!variant?.available} onClick={() => variant && void doAdd(variant.id, qty)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-forest text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50">
              <Plus size={15} />Cart mein daalein
            </motion.button>
          </div>
        </div>
      )}

      {state === "added" && (
        <div className="flex gap-2">
          <button type="button" onClick={() => void undo()} className="flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold text-ink-muted transition hover:bg-co-panel"><Undo2 size={14} />Undo</button>
          <CheckoutButton />
        </div>
      )}
    </motion.div>
  );
}
