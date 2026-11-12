"use client";

import { cutoutUrl, variantImage } from "@/lib/image-loader";
import { Check, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { CartLine } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/utils/money";

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/**
 * "Added to cart" confirmation (rendered by Sonner's toast.custom). Replaces auto-opening the cart
 * drawer on every add: the shopper keeps browsing and opens the cart only when they want to.
 */
export function AddedToast({ line, count, onView }: { line: CartLine; count: number; onView: () => void }) {
  const img = variantImage(line.product.images, line.variant.title) ?? line.product.images[0];
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-2.5 pr-3 shadow-[0_18px_40px_-20px_rgba(7,47,27,0.45)] sm:w-[360px]">
      <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f6efe2]">
        {/* whole pack, not a crop of its cap */}
        {img && <SmartImage src={cutoutUrl(img.url)} alt="" width={56} height={56} sizes="56px" className="!h-[50px] !w-auto max-w-full object-contain" />}
        <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-forest text-white ring-2 ring-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-forest">Added to cart</p>
        <p className="truncate text-sm font-bold text-ink">
          {shortTitle(line.product.title)} <span className="font-normal text-ink-muted">· {line.variant.title}</span>
        </p>
        <p className="text-xs text-ink-muted tabular-nums">
          {formatMoney(line.variant.price)} · {count} item{count === 1 ? "" : "s"} in cart
        </p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-forest pr-2.5 pl-3.5 text-xs font-bold text-white transition-colors hover:bg-forest-mid"
      >
        View cart <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}
