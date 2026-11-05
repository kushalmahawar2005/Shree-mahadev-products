"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Baby, Cookie, CookingPot, Droplets, Flame, LayoutGrid, Loader2, Package, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { shopByUse } from "@/data/site";
import type { Product, ProductSort } from "@/lib/commerce/types";
import { cn } from "@/lib/utils/cn";

const categories = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "oil", label: "Oils", icon: Droplets },
  { value: "honey", label: "Honey", icon: Sparkles },
  { value: "sweetener", label: "Sweeteners", icon: Package },
];

const USE_ICONS: Record<string, typeof Flame> = {
  "daily-cooking": CookingPot,
  "deep-frying": Flame,
  "pickles-tadka": Cookie,
  "hair-skin": Sparkles,
  "baby-massage": Baby,
};

const sizes = [
  { value: "all", label: "Any size" },
  { value: "small", label: "Up to 500 ml / g" },
  { value: "1l", label: "1 L / 1 kg" },
  { value: "family", label: "2 L" },
  { value: "bulk", label: "5 L & 15 L" },
];

const sorts: { value: ProductSort; label: string }[] = [
  { value: "best", label: "Bestselling" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "new", label: "Newest" },
];

function sizeMatch(p: Product, size: string) {
  const vs = p.variants.filter((v) => v.availableForSale);
  switch (size) {
    case "small":
      return vs.some((v) => v.sizeValue <= 500);
    case "1l":
      return vs.some((v) => v.sizeValue === 1000);
    case "family":
      return vs.some((v) => v.sizeValue === 2000);
    case "bulk":
      return vs.some((v) => v.sizeValue >= 5000);
    default:
      return true;
  }
}

/** Client-side filters + sort over the cached catalog. State lives in the URL. */
export function ShopListing({ products }: { products: Product[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [pending, start] = useTransition();

  const category = params.get("category") ?? "";
  const size = params.get("size") ?? "";
  const use = params.get("use") ?? "";
  const sort = (params.get("sort") as ProductSort) ?? "best";

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const count = (c: string) => products.filter((p) => !c || p.category === c).length;

  const list = useMemo(() => {
    const filtered = products.filter((p) => (!category || p.category === category) && (!use || p.tags.includes(use)) && sizeMatch(p, size));
    const min = (p: Product) => p.priceRange.min.amount || Number.POSITIVE_INFINITY;
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => min(a) - min(b));
    if (sort === "price-desc") sorted.sort((a, b) => b.priceRange.max.amount - a.priceRange.max.amount);
    if (sort === "new") sorted.reverse();
    return sorted;
  }, [products, category, use, size, sort]);

  const active = [
    category && { key: "category", label: categories.find((c) => c.value === category)?.label ?? category },
    use && { key: "use", label: shopByUse.find((u) => u.tag === use)?.label ?? use },
    size && { key: "size", label: sizes.find((s) => s.value === size)?.label ?? size },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="mt-8">
      {/* Sticky filter bar */}
      <div className="sticky top-[calc(var(--header-h,72px)+8px)] z-20 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="rounded-3xl border border-line bg-white/85 p-3 shadow-[0_14px_30px_-24px_rgba(7,47,27,0.5)] backdrop-blur-md md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Category rail */}
            <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
              <div role="tablist" aria-label="Category" className="flex w-max gap-1 rounded-full bg-khaki-soft/70 p-1">
                {categories.map((c) => {
                  const on = category === c.value;
                  const I = c.icon;
                  return (
                    <button
                      key={c.value || "all"}
                      role="tab"
                      type="button"
                      aria-selected={on}
                      onClick={() => set("category", c.value)}
                      className="relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
                    >
                      {on && <motion.span layoutId="shop-cat" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                      <I className={cn("relative size-4", on ? "text-[#e8c879]" : "text-forest/70")} />
                      <span className={cn("relative", on ? "text-white" : "text-forest-text")}>{c.label}</span>
                      <span className={cn("relative text-xs tabular-nums", on ? "text-white/70" : "text-ink-muted")}>{count(c.value)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 lg:ml-auto">
              <SlidersHorizontal className="hidden size-4 text-ink-muted sm:block" />
              <Select value={size || "all"} onValueChange={(v) => set("size", v === "all" ? "" : v)}>
                <SelectTrigger className="h-10 min-w-[150px] rounded-full border-line bg-white" aria-label="Size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => set("sort", v === "best" ? "" : v)}>
                <SelectTrigger className="h-10 min-w-[170px] rounded-full border-line bg-white" aria-label="Sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorts.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Use chips */}
          <div className="no-scrollbar -mx-1 mt-3 overflow-x-auto px-1">
            <div role="group" aria-label="Use" className="flex w-max gap-2">
              {shopByUse.map((u) => {
                const on = use === u.tag;
                const I = USE_ICONS[u.tag] ?? CookingPot;
                return (
                  <button
                    key={u.tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("use", on ? "" : u.tag)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      on ? "border-forest bg-forest/5 text-forest" : "border-line bg-white text-ink-muted hover:border-forest/40 hover:text-forest",
                    )}
                  >
                    <I className="size-4" />
                    {u.label}
                    <span className="font-hindi text-[13px] text-sale" lang="hi">
                      {u.labelHi}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Result line + active filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2" aria-live="polite">
        <p className="mr-2 flex items-center gap-2 text-sm text-ink-muted">
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          <span className="font-semibold text-forest-text tabular-nums">{list.length}</span> {list.length === 1 ? "product" : "products"}
        </p>
        {active.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => set(f.key, "")}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-forest px-3 text-xs font-semibold text-white hover:bg-forest-mid"
          >
            {f.label} <X className="size-3" />
          </button>
        ))}
        {active.length > 1 && (
          <button type="button" onClick={() => start(() => router.replace(pathname, { scroll: false }))} className="text-xs font-semibold text-forest underline-offset-2 hover:underline">
            Clear all
          </button>
        )}
      </div>

      {list.length ? (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((p, i) => (
              <motion.li
                key={p.handle}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
              >
                <PickCard product={toPickProduct(p)} priority={i < 4} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
          <p className="font-semibold text-forest-text">Nothing matches these filters.</p>
          <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="mt-3 text-sm font-semibold text-forest underline underline-offset-2">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
