"use client";

import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { shopByUse } from "@/data/site";
import type { Product } from "@/lib/commerce/types";
import { thumbUrl } from "@/lib/image-loader";
import { Gallery } from "./Gallery";
import { ProductPurchase } from "./ProductPurchase";
import { VariantImageProvider } from "./VariantImage";

/** "Quick view" button over a listing card → dialog (desktop) / bottom sheet (phone) with gallery + buy box. */
export function QuickView({ product: p }: { product: Product }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const uses = shopByUse.filter((u) => p.tags.includes(u.tag));
  const body = (
    <VariantImageProvider>
      <div className="grid gap-6 md:grid-cols-2">
        <Gallery images={p.images} title={p.title} swatch={p.swatch} />
        <div>
          <p className="font-hindi text-lg text-co-accent-ink" lang="hi">
            {p.titleHi}
          </p>
          <p className="mt-1 text-2xl leading-tight text-ink md:text-3xl">{p.title}</p>
          <p className="mt-2 text-ink-muted">{p.shortDescription}</p>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-ink-muted">
            <li>Wood-pressed</li>
            <li>· No chemicals</li>
            <li>· Lab tested</li>
          </ul>
          {uses.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {uses.map((u) => (
                <li key={u.tag} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink">
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
          <Link href={`/products/${p.handle}`} className="mt-4 inline-flex h-11 items-center gap-1 font-semibold text-forest hover:underline">
            View full details <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </VariantImageProvider>
  );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Quick view ${p.title}`}
        className="absolute top-3 right-3 z-10 hidden h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-semibold text-forest opacity-0 shadow-sm transition-opacity group-hover/qv:opacity-100 focus-visible:opacity-100 lg:inline-flex"
      >
        <Eye className="size-3.5" /> Quick view
      </button>
      {open &&
        (mobile ? (
          <Sheet open onOpenChange={setOpen}>
            <SheetContent side="bottom" className="max-h-[92svh] overflow-y-auto rounded-t-3xl bg-page p-5">
              <SheetTitle className="sr-only">{p.title}</SheetTitle>
              <SheetDescription className="sr-only">Quick view</SheetDescription>
              {body}
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open onOpenChange={setOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-page p-6 sm:max-w-4xl">
              <DialogTitle className="sr-only">{p.title}</DialogTitle>
              <DialogDescription className="sr-only">Quick view</DialogDescription>
              {body}
            </DialogContent>
          </Dialog>
        ))}
    </>
  );
}
