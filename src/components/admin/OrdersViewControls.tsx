"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ArrowDownUp, Check, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { cn } from "@/lib/utils/cn";

const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "total_desc", label: "Highest amount" },
  { id: "total_asc", label: "Lowest amount" },
] as const;
const PAYS = [
  { id: "all", label: "All payments" },
  { id: "online", label: "Online" },
  { id: "cod", label: "COD" },
] as const;
const PER_PAGE = [25, 50, 100] as const;

/**
 * Orders list toolbar: sort, payment type and rows per page. Each writes its own query param
 * (?sort= &pay= &per=) and keeps the tab, dates and search.
 */
export function OrdersViewControls({ sort, pay, per }: { sort: string; pay: string; per: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string, fallback: string) => {
    const p = new URLSearchParams(params.toString());
    p.delete("page");
    if (value === fallback) p.delete(key);
    else p.set(key, value);
    start(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? "Default order";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Payment type" className="flex rounded-full border border-line bg-surface p-1">
        {PAYS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={pay === p.id}
            onClick={() => set("pay", p.id, "all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
              pay === p.id ? "bg-forest text-white shadow-sm" : "text-ink-muted hover:text-forest-fg",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink hover:border-forest/50">
          <ArrowDownUp className="size-4 text-ink-muted" />
          {sortLabel}
          {pending && <Loader2 className="size-3.5 animate-spin" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs text-ink-muted">Sort orders</DropdownMenuLabel>
          {SORTS.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => set("sort", s.id, "")} className="h-9 justify-between">
              {s.label}
              {sort === s.id && <Check className="size-4 text-forest-fg" />}
            </DropdownMenuItem>
          ))}
          {sort && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => set("sort", "", "")} className="h-9 text-ink-muted">
                Reset to default
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <label className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface pr-2 pl-4 text-xs font-semibold text-ink-muted">
        Rows
        <select
          value={per}
          onChange={(e) => set("per", e.target.value, "25")}
          aria-label="Orders per page"
          className="h-8 rounded-full bg-transparent px-1 text-xs font-semibold text-ink outline-none"
        >
          {PER_PAGE.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
