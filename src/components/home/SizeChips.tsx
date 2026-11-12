"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { cn } from "@/lib/utils/cn";

type Size = { id: string; title: string; soldOut?: boolean };

const chipBase = "shrink-0 rounded-full border whitespace-nowrap transition-colors duration-200";
const chipSize = { md: "h-9 px-3 text-[13px] md:text-sm", sm: "h-8 px-2.5 text-[12.5px]" } as const;
const GAP = 6;

/**
 * One row of size chips that never clips: shows as many whole chips as fit, then "+N"
 * which opens a small list of every size. The selected size is always visible.
 */
export function SizeChips({
  sizes,
  selectedId,
  onSelect,
  label,
  max,
  size = "md",
}: {
  sizes: Size[];
  selectedId?: string;
  onSelect: (id: string) => void;
  label: string;
  /** Never show more than this many chips before "+N". */
  max?: number;
  size?: keyof typeof chipSize;
}) {
  const chip = cn(chipBase, chipSize[size]);
  const wrap = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(Math.min(sizes.length, max ?? sizes.length));
  const [open, setOpen] = useState(false);

  // Measure every chip (hidden copy) and the "+N" chip, then work out how many fit.
  useLayoutEffect(() => {
    const el = wrap.current;
    const m = measure.current;
    if (!el || !m) return;
    const calc = () => {
      const widths = [...m.children].map((c) => (c as HTMLElement).offsetWidth);
      const more = widths.pop() ?? 40;
      const avail = el.clientWidth;
      let used = 0;
      let n = 0;
      for (let i = 0; i < widths.length; i++) {
        const w = widths[i] + (i ? GAP : 0);
        const needMore = i < widths.length - 1 ? GAP + more : 0;
        if (used + w + needMore > avail) break;
        used += w;
        n++;
      }
      setFit(Math.max(1, Math.min(n, max ?? n)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sizes, max, size]);


  // Visible chips: first `fit`, with the selected one swapped into the last slot if it overflows.
  let visible = sizes.slice(0, fit);
  const selIdx = sizes.findIndex((s) => s.id === selectedId);
  if (selIdx >= fit && fit > 0)
    visible = [...sizes.slice(0, fit - 1), sizes[selIdx]];
  const hidden = sizes.length - visible.length;

  return (
    <div ref={wrap} className="relative">
      {/* Off-screen measuring row: same chips + a "+N" chip */}
      {/* Zero-size, clipped wrapper so the measuring row never adds scroll width to the carousel. */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 h-0 w-0 overflow-hidden"
      >
        <div ref={measure} className="flex w-max whitespace-nowrap">
          {sizes.map((s) => (
            <span
              key={s.id}
              className={cn(
                chip,
                "inline-flex items-center border-khaki font-semibold",
              )}
            >
              {s.title}
            </span>
          ))}
          <span className={cn(chip, "inline-flex items-center border-khaki")}>
            +{sizes.length}
          </span>
        </div>
      </div>

      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {visible.map((s) => {
          const on = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(s.id)}
              className={cn(
                chip,
                on
                  ? "border-forest bg-forest font-semibold text-white"
                  : "border-khaki bg-white text-forest-text hover:border-forest",
              )}
            >
              {s.title}
            </button>
          );
        })}
        {hidden > 0 && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(chip, "border-khaki bg-white text-forest-text hover:border-forest")}
                aria-label={`${hidden} more sizes`}
              >
                +{hidden}
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto min-w-40 rounded-xl border-line bg-white p-1 shadow-[0_12px_32px_-12px_rgba(7,47,27,0.35)]">
              <ul role="listbox" aria-label={label} className="max-h-56 overflow-y-auto">
                {sizes.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={s.id === selectedId}
                      onClick={() => {
                        onSelect(s.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm",
                        s.id === selectedId ? "bg-khaki-soft font-semibold text-forest-text" : "hover:bg-khaki-soft/60",
                      )}
                    >
                      <span className={cn(s.soldOut && "line-through")}>{s.title}</span>
                      {s.soldOut ? <span className="text-xs text-ink-muted">Sold out</span> : s.id === selectedId && <span aria-hidden>✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
