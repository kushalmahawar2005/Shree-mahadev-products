"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { RotateCcw, Search, X } from "lucide-react";
import { ShopCard, type ShopProduct } from "@/components/chat/ChatCommerce";
import { rise, staggerParent, tap } from "@/components/chat/motion";

const CATEGORIES = [
  { id: "all", label: "Sab" },
  { id: "oil", label: "Oils" },
  { id: "honey", label: "Honey" },
  { id: "sweetener", label: "Sweeteners" },
] as const;

/** Shop tab: category chips, search and the same product card used in replies. */
export default function ShopTab() {
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/chat/catalog")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { products: ShopProduct[] }) => { if (alive) { setProducts(data.products); setFailed(false); } })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products ?? []).filter((product) => (category === "all" || product.category === category) && (!q || `${product.title} ${product.titleHi ?? ""}`.toLowerCase().includes(q)));
  }, [products, category, query]);

  return (
    <div className="space-y-3 px-3.5 py-3.5">
      <label className="relative block">
        <span className="sr-only">Search products</span>
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tel, shahad, khand…" className="h-11 w-full rounded-full border border-line bg-white pl-10 pr-10 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted focus:border-forest/40 focus:ring-2 focus:ring-forest/10" />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:text-forest"><X size={15} /></button>}
      </label>

      <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 [scrollbar-width:none]" role="radiogroup" aria-label="Category">
        {CATEGORIES.map((item) => (
          <motion.button
            key={item.id}
            {...tap}
            type="button"
            role="radio"
            aria-checked={category === item.id}
            onClick={() => setCategory(item.id)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${category === item.id ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-forest/30"}`}
          >
            {item.label}
          </motion.button>
        ))}
      </div>

      {failed ? (
        <div className="rounded-2xl border border-warm-line bg-warm p-4 text-sm text-ink">
          Products load nahi ho paaye.
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="ml-2 inline-flex items-center gap-1 font-semibold text-forest underline underline-offset-2"><RotateCcw size={13} />Dobara try karein</button>
        </div>
      ) : !products ? (
        <div className="space-y-2.5">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-co-panel" />)}</div>
      ) : !shown.length ? (
        <p className="py-8 text-center text-sm text-ink-muted">“{query}” se koi product nahi mila.</p>
      ) : (
        <motion.div key={category} initial="hidden" animate="show" variants={staggerParent(0.04)} className="space-y-2.5">
          {shown.map((product) => (
            <motion.div key={product.handle} variants={rise}><ShopCard product={product} /></motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
