"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Loader2, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/shadcn/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { cn } from "@/lib/utils/cn";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string) => new Date(`${s}T00:00:00`);
const nice = (s: string) => fromIso(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
};

const PRESETS = [
  { id: "all", label: "All time", range: () => null },
  { id: "today", label: "Today", range: () => [shift(0), shift(0)] },
  { id: "yesterday", label: "Yesterday", range: () => [shift(-1), shift(-1)] },
  { id: "7d", label: "7 days", range: () => [shift(-6), shift(0)] },
  { id: "30d", label: "30 days", range: () => [shift(-29), shift(0)] },
  {
    id: "month",
    label: "This month",
    range: () => {
      const d = new Date();
      return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), shift(0)];
    },
  },
] as const;

/** Orders list: date presets + a custom range (shadcn Calendar). Writes ?from=&to= and keeps the tab / search. */
export function OrdersDateFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(from ? { from: fromIso(from), to: fromIso(to || from) } : undefined);

  const go = (next: [string, string] | null) => {
    const p = new URLSearchParams(params.toString());
    p.delete("page");
    if (next) {
      p.set("from", next[0]);
      p.set("to", next[1]);
    } else {
      p.delete("from");
      p.delete("to");
    }
    start(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const active = PRESETS.find((pr) => {
    const r = pr.range();
    return r ? r[0] === from && r[1] === to : !from && !to;
  })?.id;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-full border border-line bg-surface p-1">
        {PRESETS.map((pr) => (
          <button
            key={pr.id}
            type="button"
            onClick={() => go(pr.range() as [string, string] | null)}
            aria-pressed={active === pr.id}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
              active === pr.id ? "bg-forest text-white shadow-sm" : "text-ink-muted hover:text-forest-fg",
            )}
          >
            {pr.label}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full border bg-surface px-4 text-xs font-semibold transition-colors hover:border-forest/50",
            from && !active ? "border-forest text-forest-fg" : "border-line text-ink-muted",
          )}
        >
          <CalendarDays className="size-4" />
          {from ? (from === to ? nice(from) : `${nice(from)} – ${nice(to)}`) : "Custom dates"}
          {pending && <Loader2 className="size-3.5 animate-spin" />}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} defaultMonth={range?.from} disabled={{ after: new Date() }} className="rounded-xl" />
          <div className="flex items-center justify-between gap-3 border-t border-line p-3">
            <span className="text-xs text-ink-muted">
              {range?.from ? `${nice(iso(range.from))} – ${nice(iso(range.to ?? range.from))}` : "Pick a start and end date"}
            </span>
            <button
              type="button"
              disabled={!range?.from}
              onClick={() => {
                if (!range?.from) return;
                go([iso(range.from), iso(range.to ?? range.from)]);
                setOpen(false);
              }}
              className="h-9 rounded-full bg-forest px-4 text-xs font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50"
            >
              Show orders
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {from && (
        <button type="button" onClick={() => go(null)} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-xs font-semibold text-ink-muted hover:bg-khaki-soft">
          <X className="size-3.5" /> Clear dates
        </button>
      )}
    </div>
  );
}
