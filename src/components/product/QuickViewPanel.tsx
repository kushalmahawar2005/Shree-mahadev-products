"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/shadcn/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { shopByUse } from "@/data/site";
import type { Product } from "@/lib/commerce/types";
import { thumbUrl } from "@/lib/image-loader";
import { Gallery } from "./Gallery";
import { ProductPurchase } from "./ProductPurchase";
import { VariantImageProvider } from "./VariantImage";

/** Quick view content: dialog (desktop) / bottom sheet (phone) with gallery + buy box. Loaded on first open. */
export function QuickViewPanel({
  product: p,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  const setOpen = (v: boolean) => {
    if (!v) onClose();
  };
  const uses = shopByUse.filter((u) => p.tags.includes(u.tag));
  const body = (
    <VariantImageProvider>
      {/* Photo column sized to the dialog (not the viewport) and kept in view while the buy box scrolls. */}
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] md:gap-8">
        <div className="min-w-0 md:sticky md:top-0 md:self-start">
          <Gallery images={p.images} title={p.title} swatch={p.swatch} fit />
        </div>
        <div className="min-w-0">
          <p
            className="font-hindi text-base leading-snug text-co-accent-ink md:text-lg"
            lang="hi"
          >
            {p.titleHi}
          </p>
          <p className="mt-1 text-[22px] leading-tight font-semibold text-ink md:text-[28px]">
            {p.title}
          </p>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted md:text-base">
            {p.shortDescription.replace(/\*\*/g, "")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-ink-muted">
            <li>Wood-pressed</li>
            <li>· No chemicals</li>
            <li>· Lab tested</li>
          </ul>
          {uses.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {uses.map((u) => (
                <li
                  key={u.tag}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-ink"
                >
                  {u.label}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5">
            <ProductPurchase
              compact
              handle={p.handle}
              title={p.title}
              variants={p.variants}
              defaultSize={p.defaultSize}
              image={p.images[0] ? thumbUrl(p.images[0].url, 44) : undefined}
            />
          </div>
          <Link
            href={`/products/${p.handle}`}
            className="mt-4 inline-flex h-11 items-center gap-1 font-semibold text-forest hover:underline"
          >
            View full details <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </VariantImageProvider>
  );
  return mobile ? (
    <Sheet open onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="max-h-[92svh] overflow-y-auto rounded-t-3xl bg-page p-5"
      >
        <SheetTitle className="sr-only">{p.title}</SheetTitle>
        <SheetDescription className="sr-only">Quick view</SheetDescription>
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-page p-6 sm:max-w-5xl md:p-8">
        <DialogTitle className="sr-only">{p.title}</DialogTitle>
        <DialogDescription className="sr-only">Quick view</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}
