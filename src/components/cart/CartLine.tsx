"use client";

import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMoney } from "@/lib/utils/money";
import type { CartLine } from "@/lib/commerce/types";
import { useCart } from "./CartProvider";

export function CartLineItem({ line }: { line: CartLine }) {
  const { update, remove, pending, close } = useCart();
  const img = line.product.images[0];

  return (
    <li className="flex gap-4 py-4">
      {img && (
        <SmartImage
          src={img.url}
          alt={img.alt}
          width={80}
          height={80}
          className="size-20 shrink-0 rounded-[var(--radius-img)] bg-khaki-soft object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${line.product.handle}`}
            onClick={close}
            className="font-semibold leading-snug text-forest-text hover:underline"
          >
            {line.product.title}
          </Link>
          <span className="font-bold text-forest-text">
            {formatMoney(line.variant.price.amount * line.quantity)}
          </span>
        </div>
        <p className="text-sm text-ink-muted">{line.variant.title}</p>
        <div className="mt-2 flex items-center justify-between">
          <QtyStepper
            value={line.quantity}
            disabled={pending}
            onChange={(q) => update(line.id, q)}
            label={`${line.product.title} ${line.variant.title}`}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => remove(line.id)}
            className="min-h-11 px-2 text-sm text-ink-muted underline underline-offset-2 hover:text-forest"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function QtyStepper({
  value,
  onChange,
  disabled,
  label,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  label: string;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-line" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="grid size-11 place-items-center rounded-full text-forest hover:bg-khaki-soft disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled || value >= 99}
        onClick={() => onChange(value + 1)}
        className="grid size-11 place-items-center rounded-full text-forest hover:bg-khaki-soft disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
