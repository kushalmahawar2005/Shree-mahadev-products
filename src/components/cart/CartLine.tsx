"use client";

import { cutoutUrl, variantImage } from "@/lib/image-loader";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMoney } from "@/lib/utils/money";
import type { CartLine, ProductVariant } from "@/lib/commerce/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { useCart } from "./CartProvider";

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/**
 * One cart line: photo card, name, size picker (switches the line to another size, same qty),
 * price with MRP struck + % off, stepper and remove.
 */
export function CartLineItem({
  line,
  sizes = [],
  flash = 0,
  onRemoved,
}: {
  line: CartLine;
  sizes?: ProductVariant[];
  /** Changes (non-zero) when this line was just added: brief mustard highlight. */
  flash?: number;
  /** Called after the line is removed, so the drawer can offer Undo. */
  onRemoved?: (line: CartLine) => void;
}) {
  const { update, remove, add, close } = useCart();
  const [busy, setBusy] = useState(false);
  const img = variantImage(line.product.images, line.variant.title) ?? line.product.images[0];
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const mrp = line.variant.compareAtPrice && line.variant.compareAtPrice.amount > line.variant.price.amount ? line.variant.compareAtPrice.amount * line.quantity : 0;
  const pctOff = mrp > 0 ? Math.round(((mrp - line.variant.price.amount * line.quantity) / mrp) * 100) : 0;
  const options = sizes.filter((v) => v.availableForSale || v.id === line.variant.id);
  // Switch size: add the new size with the same quantity, then drop this line.
  const switchSize = (id: string) =>
    id !== line.variant.id &&
    run(async () => {
      await add(id, line.quantity);
      await remove(line.id);
    });

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-2.5 flex gap-3 overflow-hidden rounded-2xl border border-line/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(7,47,27,0.04)]"
    >
      {/* just added: a short mustard flash */}
      {flash > 0 && (
        <motion.span
          key={flash}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-mustard/25"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      )}
      {/* pending update: shimmer on this line only */}
      {busy && <span aria-hidden className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-white/50" />}
      <Link
        href={`/products/${line.product.handle}`}
        onClick={close}
        className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f6efe2]"
      >
        {img && <SmartImage src={cutoutUrl(img.url)} alt={img.alt} width={80} height={80} sizes="76px" className="!h-[68px] !w-auto max-w-full object-contain" />}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${line.product.handle}`} onClick={close} className="line-clamp-2 text-[15px] leading-snug font-semibold text-forest-text hover:text-forest">
              {shortTitle(line.product.title)}
            </Link>
            {options.length > 1 ? (
              <Select value={line.variant.id} onValueChange={switchSize} disabled={busy}>
                <SelectTrigger size="sm" className="mt-1.5 !h-7 w-auto min-w-0 gap-1 rounded-lg border-line bg-white px-2 text-xs font-medium text-forest-text" aria-label={`Size for ${line.product.title}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-[13px]">
                      {v.title} · {formatMoney(v.price.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="mt-0.5 inline-block rounded-md bg-khaki-soft px-1.5 py-0.5 text-[11px] font-medium text-forest-text">{line.variant.title}</span>
            )}
          </div>
          <div className="shrink-0 text-right">
            {mrp > 0 && <p className="text-[11px] text-ink-muted line-through tabular-nums">{formatMoney(mrp)}</p>}
            <p className="text-[15px] font-extrabold text-forest-text tabular-nums">{formatMoney(line.variant.price.amount * line.quantity)}</p>
            {pctOff > 0 && <p className="text-[11px] font-bold text-[#1f7a3d] tabular-nums">{pctOff}% OFF</p>}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-end gap-1 pt-1.5">
          <QtyStepper
            value={line.quantity}
            disabled={busy}
            busy={busy}
            onChange={(q) => run(() => update(line.id, q))}
            label={`${line.product.title} ${line.variant.title}`}
            size="sm"
            min={1}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await remove(line.id);
                onRemoved?.(line);
              })
            }
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
    <div className="inline-flex items-center rounded-full border border-line bg-[#fbf8f1]" role="group" aria-label={`Quantity for ${label}`}>
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
