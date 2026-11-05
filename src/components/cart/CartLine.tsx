"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMoney } from "@/lib/utils/money";
import type { CartLine } from "@/lib/commerce/types";
import { useCart } from "./CartProvider";

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/** One cart line: photo card, name + size, line total (with MRP), stepper and remove. */
export function CartLineItem({ line }: { line: CartLine }) {
  const { update, remove, close } = useCart();
  const [busy, setBusy] = useState(false);
  const img = line.product.images[0];
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const mrp = line.variant.compareAtPrice && line.variant.compareAtPrice.amount > line.variant.price.amount ? line.variant.compareAtPrice.amount * line.quantity : 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mb-3 flex gap-3 rounded-2xl border border-line bg-white p-3"
    >
      <Link
        href={`/products/${line.product.handle}`}
        onClick={close}
        className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_60%,#f3e6c8,#f6efe2_70%)]"
      >
        {img && <SmartImage src={img.url} alt={img.alt} width={80} height={80} className="size-[72px] object-contain" />}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${line.product.handle}`} onClick={close} className="line-clamp-1 text-[15px] font-semibold text-ink hover:text-forest">
              {shortTitle(line.product.title)}
            </Link>
            <span className="mt-0.5 inline-block rounded-md bg-khaki-soft px-1.5 py-0.5 text-[11px] font-medium text-forest-text">{line.variant.title}</span>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-bold text-forest tabular-nums">{formatMoney(line.variant.price.amount * line.quantity)}</p>
            {mrp > 0 && <p className="text-[11px] text-ink-muted line-through tabular-nums">{formatMoney(mrp)}</p>}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <QtyStepper
            value={line.quantity}
            disabled={busy}
            busy={busy}
            onChange={(q) => run(() => update(line.id, q))}
            label={`${line.product.title} ${line.variant.title}`}
            size="sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => remove(line.id))}
            className="grid size-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-alert-soft hover:text-alert disabled:opacity-50"
            aria-label={`Remove ${line.product.title}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </motion.li>
  );
}

export function QtyStepper({
  value,
  onChange,
  disabled,
  busy,
  label,
  min = 0,
  size = "md",
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  min?: number;
  size?: "sm" | "md";
}) {
  const btn = size === "sm" ? "size-8" : "size-11";
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className={`grid ${btn} place-items-center rounded-full text-forest transition-colors hover:bg-khaki-soft disabled:opacity-40`}
        aria-label="Decrease quantity"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="grid w-7 place-items-center text-sm font-semibold tabular-nums" aria-live="polite">
        {busy ? <Loader2 className="size-3.5 animate-spin text-ink-muted" /> : value}
      </span>
      <button
        type="button"
        disabled={disabled || value >= 99}
        onClick={() => onChange(value + 1)}
        className={`grid ${btn} place-items-center rounded-full text-forest transition-colors hover:bg-khaki-soft disabled:opacity-40`}
        aria-label="Increase quantity"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
