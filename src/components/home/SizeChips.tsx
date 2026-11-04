"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Size = { id: string; title: string; soldOut?: boolean };

const chip =
  "h-8 shrink-0 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors duration-200 md:text-sm";
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
}: {
  sizes: Size[];
  selectedId?: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(sizes.length);
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
      setFit(Math.max(1, n));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sizes]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !wrap.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

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
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              chip,
              "border-khaki bg-white text-forest-text hover:border-forest",
            )}
            aria-label={`${hidden} more sizes`}
          >
            +{hidden}
          </button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute bottom-full left-0 z-20 mb-2 max-h-56 min-w-36 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-[0_12px_32px_-12px_rgba(7,47,27,0.35)]"
        >
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
                  s.id === selectedId
                    ? "bg-khaki-soft font-semibold text-forest-text"
                    : "hover:bg-khaki-soft/60",
                )}
              >
                <span className={cn(s.soldOut && "line-through")}>{s.title}</span>
                {s.soldOut ? <span className="text-xs text-ink-muted">Sold out</span> : s.id === selectedId && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
