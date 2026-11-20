"use client";

import dynamic from "next/dynamic";
import { Eye } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/commerce/types";

// Gallery + buy box + dialog code loads on the first click, not with the shop page.
const QuickViewPanel = dynamic(() => import("./QuickViewPanel").then((m) => m.QuickViewPanel), { ssr: false });

/** "Quick view" button over a listing card → dialog (desktop) / bottom sheet (phone) with gallery + buy box. */
export function QuickView({ product: p }: { product: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={() => void import("./QuickViewPanel")}
        aria-label={`Quick view ${p.title}`}
        className="absolute top-3 right-3 z-10 hidden h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-semibold text-forest opacity-0 shadow-sm transition-opacity group-hover/qv:opacity-100 focus-visible:opacity-100 lg:inline-flex"
      >
        <Eye className="size-3.5" /> Quick view
      </button>
      {open && <QuickViewPanel product={p} onClose={() => setOpen(false)} />}
    </>
  );
}
