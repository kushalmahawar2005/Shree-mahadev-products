"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, Loader2, Search, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/shadcn/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { cn } from "@/lib/utils/cn";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
] as const;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string) => new Date(`${s}T00:00:00`);
const label = (s: string) => fromIso(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Updates URL search params in a transition, keeping the rest. */
function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (changes: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const href = `${pathname}?${next.toString()}`;
    startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
  };
  return { update, pending, params };
}

/** Preset tabs + calendar range picker (shadcn Calendar in a Popover). */
export function DateRangeControl({ preset, from, to }: { preset: string; from: string; to: string }) {
  const { update, pending } = useParamUpdater();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>({ from: fromIso(from), to: fromIso(to) });

  const apply = () => {
    if (!range?.from) return;
    const end = range.to ?? range.from;
    update({ range: "custom", from: iso(range.from), to: iso(end), page: null });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-line bg-surface p-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => update({ range: p.id, from: null, to: null, page: null })}
            aria-pressed={preset === p.id}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              preset === p.id ? "bg-forest text-white shadow-sm" : "text-ink-muted hover:text-forest-fg",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full border bg-surface px-4 text-xs font-semibold transition-colors hover:border-forest/50",
            preset === "custom" ? "border-forest text-forest-fg" : "border-line text-ink-muted",
          )}
        >
          <CalendarDays className="size-4" />
          {label(from)} – {label(to)}
          {pending && <Loader2 className="size-3.5 animate-spin" />}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={setRange}
            defaultMonth={range?.from}
            disabled={{ after: new Date() }}
            className="rounded-xl"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line p-3">
            <span className="text-xs text-ink-muted">
              {range?.from ? `${label(iso(range.from))} – ${label(iso(range.to ?? range.from))}` : "Pick a start date"}
            </span>
            <button
              type="button"
              onClick={apply}
              disabled={!range?.from}
              className="h-9 rounded-full bg-forest px-4 text-xs font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50"
            >
              Apply range
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Search-as-you-type for the dashboard order table (debounced URL update). */
export function OrderSearch({ initial }: { initial: string }) {
  const { update, pending } = useParamUpdater();
  const [value, setValue] = useState(initial);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ q: value.trim() || null, page: null }, true), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the text changes
  }, [value]);

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search order no., customer or phone"
        aria-label="Search dashboard orders"
        className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-10 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-forest focus:ring-2 focus:ring-forest/15"
      />
      {pending ? (
        <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" />
      ) : (
        value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setValue("")}
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft"
          >
            <X className="size-3.5" />
          </button>
        )
      )}
    </div>
  );
}
