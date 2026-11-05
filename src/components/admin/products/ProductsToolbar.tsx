"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STATUS_LABEL = { all: "All", active: "Active", draft: "Draft", archived: "Archived" } as const;
const CATEGORY_LABEL = { all: "All categories", oil: "Oils", honey: "Honey", sweetener: "Sweeteners" } as const;

/** Status tabs, category pills and search-as-you-type for the products list. */
export function ProductsToolbar({
  status,
  category,
  q,
  statusCounts,
  statusLinks,
  categoryLinks,
}: {
  status: keyof typeof STATUS_LABEL;
  category: keyof typeof CATEGORY_LABEL;
  q: string;
  statusCounts: Record<keyof typeof STATUS_LABEL, number>;
  statusLinks: Record<string, string>;
  categoryLinks: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(q);
  const [pending, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the text changes
  }, [value]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex rounded-full border border-line bg-surface p-1">
        {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
          <Link
            key={s}
            href={statusLinks[s]}
            scroll={false}
            aria-current={status === s ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
              status === s ? "bg-forest text-white" : "text-ink-muted hover:text-forest-fg",
            )}
          >
            {STATUS_LABEL[s]}
            <span className={cn("text-[11px]", status === s ? "text-white/70" : "text-ink-muted/70")}>{statusCounts[s]}</span>
          </Link>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((c) => (
          <Link
            key={c}
            href={categoryLinks[c]}
            scroll={false}
            aria-current={category === c ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold transition-colors",
              category === c ? "bg-khaki-soft text-forest-text ring-1 ring-forest/30" : "text-ink-muted hover:bg-khaki-soft hover:text-forest-fg",
            )}
          >
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
      </div>
      <div className="relative lg:ml-auto lg:w-80">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search name, Hindi name or SKU"
          aria-label="Search products"
          className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-10 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-forest focus:ring-2 focus:ring-forest/15"
        />
        {pending ? (
          <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" />
        ) : (
          value && (
            <button type="button" aria-label="Clear search" onClick={() => setValue("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft">
              <X className="size-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
