"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { useCart } from "@/components/cart/CartProvider";
import { cutoutUrl } from "@/lib/image-loader";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";

export type BundleItem = { variantId: string; handle: string; title: string; size: string; price: number; mrp?: number; image?: string };

const short = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/** This product + 2 complements as equal cards, with a summary (total, MRP saving) and one "add all" button. */
export function BoughtTogether({ items }: { items: BundleItem[] }) {
  const { add, open } = useCart();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.variantId, true])));
  const [pending, start] = useTransition();
  const chosen = items.filter((i) => on[i.variantId]);
  const total = chosen.reduce((s, i) => s + i.price, 0);
  const mrp = chosen.reduce((s, i) => s + Math.max(i.mrp ?? i.price, i.price), 0);
  const save = mrp - total;

  return (
    <div className="grid overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_18px_50px_-30px_rgba(7,47,27,0.35)] lg:grid-cols-[minmax(0,1fr)_16rem]">
      {/* Phones: three small tiles in one row (tick on the photo). sm+: three cards. */}
      <ul className="grid grid-cols-3 gap-2 bg-[#faf6eb] p-2.5 sm:gap-3 sm:p-5">
        {items.map((i, n) => {
          const checked = !!on[i.variantId];
          return (
              <li key={i.variantId} className="min-w-0">
                <motion.label
                  whileTap={{ scale: 0.96 }}
                  animate={{ opacity: checked ? 1 : 0.55 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "relative flex h-full cursor-pointer flex-col gap-2 rounded-2xl border p-1.5 transition-colors sm:gap-3 sm:p-3",
                    checked ? "border-forest/25 bg-surface shadow-[0_8px_24px_-16px_rgba(7,47,27,0.35)]" : "border-line bg-surface",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setOn((s) => ({ ...s, [i.variantId]: !s[i.variantId] }))}
                    className="peer sr-only"
                  />
                  <span className="relative block aspect-square w-full shrink-0 overflow-hidden rounded-xl sm:aspect-auto sm:h-32 lg:h-40 bg-[radial-gradient(circle_at_50%_60%,#fff_0%,#F4EEE2_70%)]">
                    {i.image && <Image src={cutoutUrl(i.image)} alt="" fill sizes="(min-width: 640px) 220px, 30vw" className="object-contain p-1.5" />}
                  </span>
                  <span className="min-w-0 flex-1 px-0.5 pb-0.5 sm:px-0 sm:pb-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-co-accent-ink sm:text-[11px]">{n === 0 ? "This item" : "Add on"}</span>
                    <span className="line-clamp-2 block text-[12.5px] leading-tight font-semibold text-ink sm:text-sm">{short(i.title)}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-muted tabular-nums sm:text-xs">
                      {i.size} · <span className="font-semibold text-ink">{formatMoney(i.price)}</span>
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-2.5 right-2.5 grid size-5 shrink-0 place-items-center rounded-md shadow-sm sm:top-4 sm:right-4 sm:size-6 border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-forest",
                      checked ? "border-forest bg-forest text-white" : "border-line bg-surface",
                    )}
                  >
                    {checked && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                        <Check className="size-3 sm:size-3.5" strokeWidth={3} />
                      </motion.span>
                    )}
                  </span>
                </motion.label>
              </li>

          );
        })}
      </ul>

      <div className="relative grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 bg-forest px-4 py-3.5 text-white lg:flex lg:flex-col lg:items-stretch lg:justify-center lg:px-5 lg:py-4">
        <div className="min-w-0">
        <p className="text-xs text-white/70 sm:text-sm">
          Total for {chosen.length} item{chosen.length === 1 ? "" : "s"}
        </p>
        <p className="flex items-baseline gap-2">
          <NumberFlow
            value={total}
            format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
            locales="en-IN"
            className="text-2xl leading-tight font-extrabold text-white tabular-nums sm:text-4xl"
          />
          {save > 0 && <s className="text-sm text-white/55 tabular-nums">{formatMoney(mrp)}</s>}
        </p>
        {save > 0 && <p className="text-[11px] font-semibold text-[#9BE3B4] tabular-nums sm:text-xs">You save {formatMoney(save)} on MRP</p>}
        </div>
        <button
          type="button"
          disabled={!chosen.length || pending}
          onClick={() =>
            start(async () => {
              for (const i of chosen) await add(i.variantId, 1);
              open();
            })
          }
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#E8C879] px-4 text-[13px] lg:mt-2.5 lg:w-full lg:text-sm font-semibold text-forest-text transition-colors hover:bg-white disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
          <span className="sm:hidden">{chosen.length ? `Add ${chosen.length}` : "Pick one"}</span>
          <span className="max-sm:hidden">{chosen.length === items.length ? `Add all ${items.length} to cart` : chosen.length ? `Add ${chosen.length} to cart` : "Pick an item"}</span>
        </button>
      </div>
    </div>
  );
}
