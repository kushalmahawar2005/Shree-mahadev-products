"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Check, Loader2, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { cutoutUrl } from "@/lib/image-loader";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";

export type BundleItem = { variantId: string; handle: string; title: string; size: string; price: number; image?: string };

/** This product + 2 complements: tick what you want, one tap adds them all and opens the cart. */
export function BoughtTogether({ items }: { items: BundleItem[] }) {
  const { add, open } = useCart();
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.variantId, true])));
  const [pending, start] = useTransition();
  const chosen = items.filter((i) => on[i.variantId]);
  const total = chosen.reduce((s, i) => s + i.price, 0);

  return (
    <div className="rounded-3xl border border-line bg-white p-5 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <ul className="flex flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] md:gap-4">
          {items.map((i, n) => (
            <li key={i.variantId} className="flex shrink-0 items-center gap-2 md:gap-4">
              {n > 0 && <Plus className="size-5 text-ink-muted" aria-hidden />}
              <label className={cn("relative block w-28 cursor-pointer md:w-36", !on[i.variantId] && "opacity-50")}>
                <input
                  type="checkbox"
                  checked={!!on[i.variantId]}
                  onChange={() => setOn((s) => ({ ...s, [i.variantId]: !s[i.variantId] }))}
                  className="peer sr-only"
                />
                <span className="absolute top-2 left-2 z-10 grid size-6 place-items-center rounded-md border border-line bg-white peer-checked:border-forest peer-checked:bg-forest peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-forest">
                  {on[i.variantId] && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="grid aspect-square place-items-center rounded-2xl bg-sunken">
                  {i.image && <Image src={cutoutUrl(i.image)} alt="" width={120} height={120} className="h-4/5 w-auto object-contain" />}
                </span>
                <span className="mt-2 block truncate text-sm font-semibold text-ink">
                  {n === 0 ? "This item: " : ""}
                  {i.title.replace(/^(Wood|Cold)-Pressed\s+/, "")}
                </span>
                <span className="block text-xs text-ink-muted tabular-nums">
                  {i.size} · {formatMoney(i.price)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="shrink-0 lg:w-64">
          <p className="text-sm text-ink-muted">
            Total for {chosen.length} item{chosen.length === 1 ? "" : "s"}
          </p>
          <p className="text-3xl font-extrabold text-ink tabular-nums">{formatMoney(total)}</p>
          <button
            type="button"
            disabled={!chosen.length || pending}
            onClick={() =>
              start(async () => {
                for (const i of chosen) await add(i.variantId, 1);
                open();
              })
            }
            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest text-[15px] font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
            Add {chosen.length === items.length ? `all ${items.length}` : chosen.length} to cart
          </button>
        </div>
      </div>
    </div>
  );
}
