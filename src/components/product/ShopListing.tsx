"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useLoadingSignal } from "@/components/motion/LoadingBar";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, ArrowUpDown, Loader2, SlidersHorizontal, X } from "lucide-react";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { QuickView } from "./QuickView";
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

const CATEGORY_HREF: Record<string, string> = {
  oil: "/collections/wood-pressed-oils",
  honey: "/collections/raw-honey",
  sweetener: "/collections/natural-sweeteners",
};

const sizes = [
  { value: "small", label: "Up to 250 ml / g" },
  { value: "500", label: "500 ml / g" },
  { value: "1l", label: "1 L / 1 kg" },
  { value: "family", label: "2–5 L / kg" },
  { value: "bulk", label: "15 L tins" },
];

type ListSort = ProductSort | "discount" | "az";
const sorts: { value: ListSort; label: string }[] = [
  { value: "best", label: "Bestselling" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "discount", label: "Biggest discount" },
  { value: "new", label: "Newest" },
  { value: "az", label: "A–Z" },
];

/** Best % off across the product's in-stock sizes. */
const discountOf = (p: Product) =>
  Math.max(
    0,
    ...p.variants
      .filter((v) => v.availableForSale && v.compareAtPrice && v.compareAtPrice.amount > v.price.amount)
      .map((v) => (1 - v.price.amount / v.compareAtPrice!.amount) * 100),
  );
const inStock = (p: Product) => p.variants.some((v) => v.availableForSale);

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function sizeMatch(p: Product, sizesSel: string[]) {
  if (!sizesSel.length) return true;
  const vs = p.variants.filter((v) => v.availableForSale);
  return sizesSel.some((size) => {
    switch (size) {
      case "small":
        return vs.some((v) => v.sizeValue <= 250);
      case "500":
        return vs.some((v) => v.sizeValue > 250 && v.sizeValue <= 500);
      case "1l":
        return vs.some((v) => v.sizeValue === 1000);
      case "family":
        return vs.some((v) => v.sizeValue >= 2000 && v.sizeValue <= 5000);
      case "bulk":
        return vs.some((v) => v.sizeValue >= 15000);
      default:
        return true;
    }
  });
}

/** Standard shop layout: filter sidebar (sheet on mobile) + toolbar + grid. All filter state lives in the URL. */
export function ShopListing({
  products,
  hideCategory = false,
  group = false,
}: {
  products: Product[];
  hideCategory?: boolean;
  /** /shop: with no filters, show one section per category. */
  group?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [pending, start] = useTransition();
  useLoadingSignal(pending);
  const [sheet, setSheet] = useState(false);
  const [cols, setCols] = useState<3 | 4>(4);

  // `category` / `use` keep working as single values from old links; multi-select is comma-separated.
  const cats = list(params.get("category"));
  const uses = list(params.get("use"));
  const sizeSel = list(params.get("size"));
  const sort = (params.get("sort") as ListSort) ?? "best";
  const stockOnly = params.get("stock") === "1";
  const saleOnly = params.get("sale") === "1";
  // Slider spans ₹0 → the dearest card price (rounded up to ₹100), so bulk tins stay reachable.
  const maxPrice = Math.ceil(Math.max(100, ...products.map((p) => p.priceRange.min.amount)) / 100) * 100;
  const priceMax = Math.min(maxPrice, Number(params.get("max")) || maxPrice);
  const priceMin = Math.max(0, Math.min(priceMax, Number(params.get("min")) || 0));

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
  const setPrice = (lo: number, hi: number) => {
    const next = new URLSearchParams(params);
    if (lo > 0) next.set("min", String(lo));
    else next.delete("min");
    if (hi < maxPrice) next.set("max", String(hi));
    else next.delete("max");
    push(next);
  };
  const clearAll = () => push(new URLSearchParams(sort !== "best" ? { sort } : {}));

  const min = (p: Product) => p.priceRange.min.amount || Number.POSITIVE_INFINITY;
  /** Does `p` pass every active filter except the `skip` group (for faceted counts)? */
  const passes = (p: Product, skip?: string) =>
    (skip === "category" || !cats.length || cats.includes(p.category)) &&
    (skip === "use" || !uses.length || uses.some((u) => p.tags.includes(u))) &&
    (skip === "size" || sizeMatch(p, sizeSel)) &&
    (skip === "price" || (min(p) >= priceMin && (priceMax >= maxPrice || min(p) <= priceMax))) &&
    (skip === "stock" || !stockOnly || inStock(p)) &&
    (skip === "sale" || !saleOnly || discountOf(p) > 0);

  // 18–50 products: filtering in place is instant (React Compiler memoises it).
  const shown = (() => {
    const sorted = products.filter((p) => passes(p));
    if (sort === "price-asc") sorted.sort((a, b) => min(a) - min(b));
    if (sort === "price-desc") sorted.sort((a, b) => b.priceRange.max.amount - a.priceRange.max.amount);
    if (sort === "discount") sorted.sort((a, b) => discountOf(b) - discountOf(a));
    if (sort === "az") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "new") sorted.reverse();
    return sorted;
  })();

  const chips = [
    ...cats.map((c) => ({ key: "category", value: c, label: categories.find((x) => x.value === c)?.label ?? c, cur: cats })),
    ...uses.map((u) => ({ key: "use", value: u, label: shopByUse.find((x) => x.tag === u)?.label ?? u, cur: uses })),
    ...sizeSel.map((s) => ({ key: "size", value: s, label: sizes.find((x) => x.value === s)?.label ?? s, cur: sizeSel })),
  ];
  const priceOn = priceMin > 0 || priceMax < maxPrice;
  const filterCount = chips.length + (priceOn ? 1 : 0) + (stockOnly ? 1 : 0) + (saleOnly ? 1 : 0);
  // Faceted: each option's count respects the other active groups.
  const countIn = (group: string, pred: (p: Product) => boolean) => products.filter((p) => passes(p, group) && pred(p)).length;
  // Only show uses that match something in this listing (e.g. honey has no "deep frying"); keep any already ticked.
  const useOptions = shopByUse
    .filter((u) => products.some((p) => p.tags.includes(u.tag)) || uses.includes(u.tag))
    .map((u) => ({ ...u, n: countIn("use", (p) => p.tags.includes(u.tag)) }));

  const grid = (items: Product[], withPromo: boolean) => (
    <ul className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3", !group && "mt-3 md:mt-5", cols === 4 && "xl:grid-cols-4")}>
      <AnimatePresence mode="popLayout" initial={false}>
        {items.flatMap((p, i) => [
          ...(withPromo && i === 6 ? [<PromoTile key="promo" />] : []),
          <motion.li
            key={p.handle}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="group/qv relative"
          >
            <PickCard product={toPickProduct(p)} priority={withPromo && i < cols} />
            <QuickView product={p} />
          </motion.li>,
        ])}
      </AnimatePresence>
    </ul>
  );

  const filters = (
    <Accordion type="multiple" defaultValue={["category", "use", "size", "price", "more"]} className="w-full">
      {!hideCategory && (
      <FilterGroup value="category" title="Category">
        {categories.map((c) => (
          <Check key={c.value} label={c.label} count={countIn("category", (p) => p.category === c.value)} checked={cats.includes(c.value)} onChange={() => toggle("category", cats, c.value)} />
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
          <Check key={s.value} label={s.label} count={countIn("size", (p) => sizeMatch(p, [s.value]))} checked={sizeSel.includes(s.value)} onChange={() => toggle("size", sizeSel, s.value)} />
        ))}
      </FilterGroup>
      <FilterGroup value="price" title="Price">
        <div className="px-1 pt-2 pb-1">
          <Slider
            key={`${priceMin}-${priceMax}`}
            min={0}
            max={maxPrice}
            step={50}
            minStepsBetweenThumbs={1}
            defaultValue={[priceMin, priceMax]}
            onValueCommit={([lo, hi]) => setPrice(lo ?? 0, hi ?? maxPrice)}
            aria-label="Price range"
            className="[&_[data-slot=slider-range]]:bg-forest [&_[data-slot=slider-thumb]]:border-forest"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <PriceInput label="Min" value={priceMin} onCommit={(v) => setPrice(Math.min(v, priceMax), priceMax)} />
            <PriceInput label="Max" value={priceMax} onCommit={(v) => setPrice(priceMin, Math.max(v, priceMin))} />
          </div>
        </div>
      </FilterGroup>
      <FilterGroup value="more" title="Availability & offers">
        <Check label="In stock only" count={countIn("stock", inStock)} checked={stockOnly} onChange={() => setKey("stock", stockOnly ? "" : "1")} />
        <Check label="On discount" count={countIn("sale", (p) => discountOf(p) > 0)} checked={saleOnly} onChange={() => setKey("sale", saleOnly ? "" : "1")} />
      </FilterGroup>
    </Accordion>
  );

  return (
    <div className="mt-1 grid gap-8 md:mt-6 lg:grid-cols-[260px_1fr]">
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
        {/* Phones: [Filters] [Sort] as one row of equal buttons, the count small underneath. */}
        <div className="sticky top-[var(--sticky-top,64px)] z-20 -mx-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line bg-page/95 px-4 py-2 backdrop-blur transition-[top] duration-300 lg:mx-0 lg:gap-3 lg:px-0 lg:py-3">
          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetTrigger asChild>
              <button type="button" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-forest-text lg:hidden">
                <SlidersHorizontal className="size-4" /> Filters
                {filterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-forest text-[11px] text-white">{filterCount}</span>}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[88svh] gap-0 overflow-y-auto rounded-t-3xl bg-white p-0">
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

          <p className={cn("order-last flex basis-full items-center gap-2 text-xs text-ink-muted lg:order-none lg:flex lg:basis-auto lg:text-sm", shown.length === products.length && !pending && "max-lg:hidden")} aria-live="polite">
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Showing <span className="font-semibold text-forest-text tabular-nums">{shown.length}</span> of {products.length} products
          </p>

          <div className="flex flex-1 items-center gap-2 lg:ml-auto lg:flex-none">
            <div className="hidden items-center rounded-full border border-line bg-white p-0.5 xl:flex" role="group" aria-label="Grid density">
              {([3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={cols === n}
                  onClick={() => setCols(n)}
                  className={cn("h-8 rounded-full px-3 text-xs font-semibold", cols === n ? "bg-forest text-white" : "text-ink-muted hover:text-ink")}
                >
                  {n} cols
                </button>
              ))}
            </div>
            <span className="hidden text-sm text-ink-muted sm:inline">Sort by</span>
            <Select value={sort} onValueChange={(v) => setKey("sort", v === "best" ? "" : v)}>
              <SelectTrigger className="h-10 w-full min-w-0 rounded-full border-line bg-white text-sm font-semibold text-forest-text lg:h-10 lg:w-auto lg:min-w-[180px] lg:font-normal lg:text-ink" aria-label="Sort products">
                <ArrowUpDown className="size-4 shrink-0 text-forest lg:hidden" aria-hidden />
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

        {filterCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {priceOn && (
              <Chip onClick={() => setPrice(0, maxPrice)}>
                {formatMoney(priceMin)} – {formatMoney(priceMax)}
              </Chip>
            )}
            {stockOnly && <Chip onClick={() => setKey("stock", "")}>In stock</Chip>}
            {saleOnly && <Chip onClick={() => setKey("sale", "")}>On discount</Chip>}
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
            <button type="button" onClick={clearAll} className="h-10 px-2 text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline">
              Clear all
            </button>
          </div>
        )}

        {shown.length ? (
          group && filterCount === 0 && sort === "best" ? (
            // Shop all, untouched: one section per category.
            <div className="mt-5 space-y-12">
              {categories
                .map((c) => ({ ...c, items: shown.filter((p) => p.category === c.value) }))
                .filter((c) => c.items.length)
                .map((c, g) => (
                  <section key={c.value} aria-labelledby={`cat-${c.value}`}>
                    <div className="mb-4 flex items-end justify-between gap-2">
                      <h2 id={`cat-${c.value}`} className="text-xl text-ink md:text-2xl">
                        {c.label} <span className="text-base font-normal text-ink-muted tabular-nums">· {c.items.length}</span>
                      </h2>
                      <a href={CATEGORY_HREF[c.value]} className="text-sm font-semibold text-forest hover:underline">
                        View all →
                      </a>
                    </div>
                    {grid(c.items, g === 0)}
                  </section>
                ))}
            </div>
          ) : (
            grid(shown, true)
          )
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
            <p className="font-semibold text-forest-text">No products match these filters.</p>
            <button type="button" onClick={clearAll} className="mt-3 text-sm font-semibold text-forest underline underline-offset-2">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-forest/20 bg-forest/5 px-3 text-xs font-semibold text-forest tabular-nums hover:bg-forest/10"
    >
      {children} <X className="size-3" />
    </button>
  );
}

/** Min/max price box: commits on blur or Enter. */
function PriceInput({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const commit = (raw: string) => {
    const v = Math.max(0, Math.round(Number(raw.replace(/\D/g, "")) || 0));
    if (v !== value) onCommit(v);
  };
  return (
    <label className="block text-[11px] font-semibold text-ink-muted">
      {label}
      <span className="mt-1 flex h-10 items-center rounded-lg border border-line bg-white px-2 text-sm text-ink focus-within:border-forest">
        ₹
        <input
          key={value}
          defaultValue={value}
          inputMode="numeric"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
          className="w-full min-w-0 bg-transparent pl-1 text-base outline-none md:text-sm"
          aria-label={`${label} price`}
        />
      </span>
    </label>
  );
}

/** Same footprint as a card: points families and shops to bulk tins. */
function PromoTile() {
  return (
    <li key="promo" className="@container flex flex-col justify-between rounded-2xl bg-forest p-5 text-white">
      <div>
        <p className="font-hindi text-sm text-mustard" lang="hi">
          थोक ऑर्डर
        </p>
        <p className="mt-2 text-xl leading-tight font-bold">Bulk tins 5 L & 15 L</p>
        <p className="mt-2 text-sm text-white/75">For big families, sweet shops and restaurants. Better per-litre price.</p>
      </div>
      <a href="/bulk-orders" className="mt-6 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold whitespace-nowrap text-forest hover:bg-khaki-soft">
        <span className="@max-[150px]:hidden">Ask for a bulk quote</span>
        <span className="@min-[150px]:hidden">Bulk quote</span>
        <ArrowRight className="size-4 shrink-0" aria-hidden />
      </a>
    </li>
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
  const off = count === 0 && !checked;
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm transition-colors hover:bg-khaki-soft/60", checked && "text-forest", off && "cursor-not-allowed opacity-45 hover:bg-transparent")}>
      <Checkbox checked={checked} disabled={off} onCheckedChange={onChange} className="data-[state=checked]:border-forest data-[state=checked]:bg-forest" />
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
