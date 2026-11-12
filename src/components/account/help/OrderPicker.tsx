"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, CircleHelp, Loader2, RotateCw } from "lucide-react";
import { OrderStatusBadge } from "@/components/account/shared";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";
import { shortDate, toHelpOption, type HelpOrderOption } from "./help-lib";

/** "Which order?" combobox (popover + cmdk). `value` null = not about a specific order, undefined = nothing chosen. */
export function OrderPicker({
  orders,
  setOrders,
  hasMore,
  setHasMore,
  value,
  onChange,
}: {
  orders: HelpOrderOption[];
  setOrders: (fn: (prev: HelpOrderOption[]) => HelpOrderOption[]) => void;
  hasMore: boolean;
  setHasMore: (v: boolean) => void;
  value: HelpOrderOption | null | undefined;
  onChange: (v: HelpOrderOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<"more" | "search" | null>(null);
  const [error, setError] = useState(false);
  const searched = useRef(new Set<string>());

  const merge = (list: HelpOrderOption[]) =>
    setOrders((prev) => {
      const ids = new Set(prev.map((o) => o.id));
      return [...prev, ...list.filter((o) => !ids.has(o.id))].sort((a, b) => b.id - a.id);
    });

  async function fetchOrders(params: string) {
    const r = await fetch(`/api/account/orders?${params}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { orders: Parameters<typeof toHelpOption>[0][]; nextCursor: number | null };
    return { list: j.orders.map(toHelpOption), next: j.nextCursor };
  }

  async function loadMore() {
    const last = orders.at(-1);
    if (!last) return;
    setLoading("more");
    setError(false);
    try {
      const { list, next } = await fetchOrders(`cursor=${last.id}`);
      merge(list);
      setHasMore(next !== null);
    } catch {
      setError(true);
    } finally {
      setLoading(null);
    }
  }

  // Order id typed that isn't loaded yet: look it up on the server (debounced).
  useEffect(() => {
    const q = search.trim().replace(/^#/, "");
    if (q.length < 3 || searched.current.has(q.toLowerCase())) return;
    if (orders.some((o) => o.orderNo.toLowerCase().includes(q.toLowerCase()))) return;
    const t = setTimeout(async () => {
      searched.current.add(q.toLowerCase());
      setLoading("search");
      try {
        merge((await fetchOrders(`q=${encodeURIComponent(q)}`)).list);
      } catch {
        /* the list simply stays as is */
      } finally {
        setLoading(null);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merge/fetchOrders are stable in effect
  }, [search, orders]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls="help-order-list"
          aria-labelledby="help-order-label"
          className="flex h-12 w-full items-center gap-2 rounded-2xl border border-line bg-white px-4 text-left text-base text-ink outline-none hover:border-co-border-strong focus-visible:border-forest focus-visible:ring-4 focus-visible:ring-forest/10"
        >
          <span className="min-w-0 flex-1 truncate">
            {value === undefined ? (
              <span className="text-ink-muted">Choose an order</span>
            ) : value === null ? (
              "Not about a specific order"
            ) : (
              <OrderLine o={value} />
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0">
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search by order id, e.g. SMP1311" className="h-11 text-base" />
          <CommandList id="help-order-list" className="max-h-72">
            <CommandEmpty>{loading === "search" ? "Searching…" : "No order with that id."}</CommandEmpty>
            <CommandGroup heading="Your orders">
              {orders.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.orderNo} #${o.orderNo}`}
                  onSelect={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className="min-h-11"
                >
                  <OrderLine o={o} />
                  <Check className={cn("ml-auto size-4", value?.id === o.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
            {hasMore && !search && (
              <div className="px-2 pb-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading === "more"}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-forest-text hover:bg-page disabled:opacity-60"
                >
                  {loading === "more" ? <Loader2 className="size-4 animate-spin" /> : error ? <RotateCw className="size-4" /> : null}
                  {error ? "Couldn't load. Retry" : "Show older orders"}
                </button>
              </div>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="Not about a specific order general"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="min-h-11"
              >
                <CircleHelp className="size-4 text-ink-muted" /> Not about a specific order
                <Check className={cn("ml-auto size-4", value === null ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** "#SMP1311 · 12 Nov · ₹1,204 · [badge]" on one line. */
export function OrderLine({ o }: { o: HelpOrderOption }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
      <span className="font-semibold text-ink">#{o.orderNo}</span>
      <span className="text-ink-muted">· {shortDate(o.createdAt)}</span>
      <span className="text-ink-muted tabular-nums">· {formatMoney(o.total)}</span>
      <OrderStatusBadge status={o.status} className="ml-1" />
    </span>
  );
}
