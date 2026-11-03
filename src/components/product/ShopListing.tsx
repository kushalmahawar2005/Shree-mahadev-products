"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Pill } from "@/components/ui/primitives";
import { shopByUse } from "@/data/site";
import type { Product, ProductSort } from "@/lib/commerce/types";
import { ProductCard } from "./ProductCard";
import { toCardProduct } from "./cardProduct";

const categories = [
  { value: "", label: "All" },
  { value: "oil", label: "Oils" },
  { value: "honey", label: "Honey" },
  { value: "sweetener", label: "Sweeteners" },
];

const sizes = [
  { value: "", label: "Any size" },
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

  const category = params.get("category") ?? "";
  const size = params.get("size") ?? "";
  const use = params.get("use") ?? "";
  const sort = (params.get("sort") as ProductSort) ?? "best";

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const list = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        (!category || p.category === category) && (!use || p.tags.includes(use)) && sizeMatch(p, size),
    );
    const min = (p: Product) => p.priceRange.min.amount || Number.POSITIVE_INFINITY;
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => min(a) - min(b));
    if (sort === "price-desc") sorted.sort((a, b) => b.priceRange.max.amount - a.priceRange.max.amount);
    if (sort === "new") sorted.reverse();
    return sorted;
  }, [products, category, use, size, sort]);

  return (
    <div className="mt-8">
      <div className="space-y-4 border-y border-line py-5">
        <FilterRow label="Category">
          {categories.map((c) => (
            <Pill key={c.value} active={category === c.value} onClick={() => set("category", c.value)}>
              {c.label}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Use">
          <Pill active={!use} onClick={() => set("use", "")}>
            Any use
          </Pill>
          {shopByUse.map((u) => (
            <Pill key={u.tag} active={use === u.tag} onClick={() => set("use", u.tag)}>
              {u.label}
            </Pill>
          ))}
        </FilterRow>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-forest-text">
            Size
            <select
              value={size}
              onChange={(e) => set("size", e.target.value)}
              className="min-h-11 rounded-full border border-line bg-white px-4 font-normal text-ink"
            >
              {sizes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-forest-text">
            Sort
            <select
              value={sort}
              onChange={(e) => set("sort", e.target.value === "best" ? "" : e.target.value)}
              className="min-h-11 rounded-full border border-line bg-white px-4 font-normal text-ink"
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="mt-6 text-sm text-ink-muted" aria-live="polite">
        {list.length} {list.length === 1 ? "product" : "products"}
      </p>
      {list.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p, i) => (
            <li key={p.handle}>
              <ProductCard product={toCardProduct(p)} priority={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-16 text-center text-ink-muted">Nothing matches these filters.</p>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {children}
    </div>
  );
}
