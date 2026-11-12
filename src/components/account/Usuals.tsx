"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { cutoutUrl } from "@/lib/image-loader";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type Usual = {
  variantId: string;
  title: string;
  titleHi: string;
  size: string;
  price: number;
  mrp: number | null;
  image?: string;
};

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/** "Buy your usuals": snap row, one-tap Add that turns into a stepper synced with the cart. */
export function Usuals({ items }: { items: Usual[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0">
      {items.map((u) => (
        <UsualCard key={u.variantId} u={u} />
      ))}
    </div>
  );
}

function UsualCard({ u }: { u: Usual }) {
  const { cart, add, update, remove } = useCart();
  const line = cart?.lines.find((l) => l.variant.id === u.variantId);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex w-[168px] shrink-0 snap-start flex-col rounded-2xl border border-line bg-white p-3 shadow-co-card">
      <span className="grid h-28 place-items-center rounded-xl bg-page/70">
        {u.image && (
          <Image
            src={cutoutUrl(u.image)}
            alt=""
            width={112}
            height={112}
            className="h-24 w-auto object-contain"
          />
        )}
      </span>
      <p
        className="mt-2.5 truncate text-sm font-semibold text-ink"
        title={u.title}
      >
        {shortTitle(u.title)}
      </p>
      <p className="truncate text-xs text-co-accent-ink">
        {u.titleHi} <span className="text-ink-muted">· {u.size}</span>
      </p>
      <p className="mt-1 text-sm font-bold text-ink tabular-nums">
        {formatMoney(u.price)}
        {u.mrp && u.mrp > u.price && (
          <s className="ml-1.5 text-xs font-normal text-ink-muted/70">
            {formatMoney(u.mrp)}
          </s>
        )}
      </p>
      <div className="mt-auto pt-2.5">
        {line ? (
          <span
            className={cn(
              "flex h-10 items-center justify-between rounded-xl border-[1.5px] transition-colors",
              flash
                ? "border-co-success bg-co-success-soft"
                : "border-forest/40",
            )}
          >
            <button
              type="button"
              aria-label="Decrease"
              disabled={busy}
              onClick={() =>
                run(() =>
                  line.quantity <= 1
                    ? remove(line.id)
                    : update(line.id, line.quantity - 1),
                )
              }
              className="grid size-10 place-items-center text-ink-muted hover:text-ink"
            >
              <Minus className="size-4" />
            </button>
            <span className="text-sm font-bold tabular-nums">
              {flash ? (
                <Check className="size-4 text-co-success" strokeWidth={3} />
              ) : (
                line.quantity
              )}
            </span>
            <button
              type="button"
              aria-label="Increase"
              disabled={busy}
              onClick={() => run(() => update(line.id, line.quantity + 1))}
              className="grid size-10 place-items-center text-ink-muted hover:text-ink"
            >
              <Plus className="size-4" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await add(u.variantId, 1);
                setFlash(true);
                setTimeout(() => setFlash(false), 900);
              })
            }
            className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border-[1.5px] border-forest text-sm font-semibold text-forest hover:bg-co-brand-soft"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}{" "}
            Add
          </button>
        )}
      </div>
    </div>
  );
}
