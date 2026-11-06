"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/shadcn/sheet";
import { Slider } from "@/components/shadcn/slider";
import { shopByUse } from "@/data/site";
import type { Product, ProductSort } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const categories = [
  { value: "oil", label: "Wood-pressed oils" },
  { value: "honey", label: "Raw honey" },
  { value: "sweetener", label: "Natural sweeteners" },
];

const sizes = [
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

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function sizeMatch(p: Product, sizesSel: string[]) {
  if (!sizesSel.length) return true;
  const vs = p.variants.filter((v) => v.availableForSale);
  return sizesSel.some((size) => {
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
  });
}

/** Standard shop layout: filter sidebar (sheet on mobile) + toolbar + grid. All filter state lives in the URL. */
export function ShopListing({ products, hideCategory = false }: { products: Product[]; hideCategory?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState(false);

  // `category` / `use` keep working as single values from old links; multi-select is comma-separated.
  const cats = list(params.get("category"));
  const uses = list(params.get("use"));
  const sizeSel = list(params.get("size"));
  const sort = (params.get("sort") as ProductSort) ?? "best";
  const maxPrice = Math.max(100, ...products.map((p) => p.priceRange.max.amount));
  const priceMax = Number(params.get("max")) || maxPrice;

  const push = (next: URLSearchParams) => start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  const setKey = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  };
  const toggle = (key: string, current: string[], value: string) => {
    const nextVals = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setKey(key, nextVals.join(","));
  };
  const clearAll = () => push(new URLSearchParams(sort !== "best" ? { sort } : {}));

  const shown = useMemo(() => {
    const min = (p: Product) => p.priceRange.min.amount || Number.POSITIVE_INFINITY;
    const filtered = products.filter(
      (p) =>
        (!cats.length || cats.includes(p.category)) &&
        (!uses.length || uses.some((u) => p.tags.includes(u))) &&
        sizeMatch(p, sizeSel) &&
        (priceMax >= maxPrice || min(p) <= priceMax),
    );
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => min(a) - min(b));
    if (sort === "price-desc") sorted.sort((a, b) => b.priceRange.max.amount - a.priceRange.max.amount);
    if (sort === "new") sorted.reverse();
    return sorted;
  }, [products, cats, uses, sizeSel, sort, priceMax, maxPrice]);

  const chips = [
    ...cats.map((c) => ({ key: "category", value: c, label: categories.find((x) => x.value === c)?.label ?? c, cur: cats })),
    ...uses.map((u) => ({ key: "use", value: u, label: shopByUse.find((x) => x.tag === u)?.label ?? u, cur: uses })),
    ...sizeSel.map((s) => ({ key: "size", value: s, label: sizes.find((x) => x.value === s)?.label ?? s, cur: sizeSel })),
  ];
  const filterCount = chips.length + (priceMax < maxPrice ? 1 : 0);
  const countIn = (pred: (p: Product) => boolean) => products.filter(pred).length;
  // Only show uses that match something here (e.g. honey has no "deep frying"); keep any already ticked.
  const useOptions = shopByUse.map((u) => ({ ...u, n: countIn((p) => p.tags.includes(u.tag)) })).filter((u) => u.n > 0 || uses.includes(u.tag));

  const filters = (
    <Accordion type="multiple" defaultValue={["category", "use", "size", "price"]} className="w-full">
      {!hideCategory && (
      <FilterGroup value="category" title="Category">
        {categories.map((c) => (
          <Check key={c.value} label={c.label} count={countIn((p) => p.category === c.value)} checked={cats.includes(c.value)} onChange={() => toggle("category", cats, c.value)} />
        ))}
      </FilterGroup>
      )}
      {useOptions.length > 0 && (
        <FilterGroup value="use" title="Use">
          {useOptions.map((u) => (
            <Check key={u.tag} label={u.label} count={u.n} checked={uses.includes(u.tag)} onChange={() => toggle("use", uses, u.tag)} />
          ))}
        </FilterGroup>
      )}
      <FilterGroup value="size" title="Pack size">
        {sizes.map((s) => (
          <Check key={s.value} label={s.label} count={countIn((p) => sizeMatch(p, [s.value]))} checked={sizeSel.includes(s.value)} onChange={() => toggle("size", sizeSel, s.value)} />
        ))}
      </FilterGroup>
      <FilterGroup value="price" title="Price">
        <div className="px-1 pt-2 pb-1">
          <Slider
            min={0}
            max={maxPrice}
            step={50}
            defaultValue={[priceMax]}
            onValueCommit={([v]) => setKey("max", v >= maxPrice ? "" : String(v))}
            aria-label="Maximum price"
            className="[&_[data-slot=slider-range]]:bg-forest [&_[data-slot=slider-thumb]]:border-forest"
          />
          <div className="mt-3 flex justify-between text-xs text-ink-muted">
            <span>{formatMoney(0)}</span>
            <span className="font-semibold text-forest-text">Up to {formatMoney(priceMax)}</span>
          </div>
        </div>
      </FilterGroup>
    </Accordion>
  );

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--sticky-top,120px)+16px)] max-h-[calc(100dvh-var(--sticky-top,120px)-32px)] overflow-y-auto rounded-2xl border border-line bg-white p-5 transition-[top] duration-300 [scrollbar-width:thin]" data-lenis-prevent="">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-bold text-forest-text">Filters</p>
            {filterCount > 0 && (
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-forest underline-offset-2 hover:underline">
                Clear all
              </button>
            )}
          </div>
          {filters}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetTrigger asChild>
              <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-forest-text lg:hidden">
                <SlidersHorizontal className="size-4" /> Filters
                {filterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-forest text-[11px] text-white">{filterCount}</span>}
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[88vw] max-w-sm gap-0 overflow-y-auto bg-white p-0">
              <SheetHeader className="border-b border-line px-5 py-4">
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription className="text-xs">{shown.length} products match</SheetDescription>
              </SheetHeader>
              <div className="px-5 py-2">{filters}</div>
              <div className="sticky bottom-0 flex gap-2 border-t border-line bg-white p-4">
                <button type="button" onClick={clearAll} className="h-11 flex-1 rounded-full border border-line text-sm font-semibold text-forest-text">
                  Clear
                </button>
                <button type="button" onClick={() => setSheet(false)} className="h-11 flex-[2] rounded-full bg-forest text-sm font-bold text-white">
                  Show {shown.length} products
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <p className="flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Showing <span className="font-semibold text-forest-text tabular-nums">{shown.length}</span> of {products.length} products
          </p>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-ink-muted sm:inline">Sort by</span>
            <Select value={sort} onValueChange={(v) => setKey("sort", v === "best" ? "" : v)}>
              <SelectTrigger className="h-10 min-w-[180px] rounded-full border-line bg-white" aria-label="Sort products">
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

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.key + c.value}
                type="button"
                onClick={() => toggle(c.key, c.cur, c.value)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-forest/20 bg-forest/5 px-3 text-xs font-semibold text-forest hover:bg-forest/10"
              >
                {c.label} <X className="size-3" />
              </button>
            ))}
          </div>
        )}

        {shown.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((p, i) => (
                <motion.li
                  key={p.handle}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PickCard product={toPickProduct(p)} priority={i < 3} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
            <p className="font-semibold text-forest-text">Nothing matches these filters.</p>
            <button type="button" onClick={clearAll} className="mt-3 text-sm font-semibold text-forest underline underline-offset-2">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border-line">
      <AccordionTrigger className="py-3.5 text-sm font-semibold text-forest-text hover:no-underline">{title}</AccordionTrigger>
      <AccordionContent className="space-y-1 pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Check({ label, hint, count, checked, onChange }: { label: string; hint?: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm transition-colors hover:bg-khaki-soft/60", checked && "text-forest")}>
      <Checkbox checked={checked} onCheckedChange={onChange} className="data-[state=checked]:border-forest data-[state=checked]:bg-forest" />
      <span className="flex-1">
        {label}
        {hint && (
          <span className="font-hindi ml-1.5 text-[13px] text-sale" lang="hi">
            {hint}
          </span>
        )}
      </span>
      <span className="text-xs text-ink-muted tabular-nums">{count}</span>
    </label>
  );
}
