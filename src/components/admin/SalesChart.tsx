"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

type Point = { date: string; gross: number; orders: number };
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Daily sales bars (single series, brand forest). Hover/focus shows the day; a table view is always available. */
export function SalesChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.gross), 1);
  const nice = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const ticks = [nice, nice / 2, 0];
  const every = Math.max(1, Math.ceil(data.length / 8));
  const total = data.reduce((s, d) => s + d.gross, 0);
  const h = hover !== null ? data[hover] : null;

  return (
    <figure>
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-ink-muted">Sales per day</span>
        <span className="text-sm" aria-live="polite">
          {h ? (
            <>
              <strong>{short(h.date)}</strong>: {inr(h.gross)} · {h.orders} order{h.orders === 1 ? "" : "s"}
            </>
          ) : (
            <>
              Total <strong>{inr(total)}</strong>
            </>
          )}
        </span>
      </figcaption>
      <div className="relative flex h-48 gap-0">
        <div className="flex w-14 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-ink-muted" aria-hidden>
          {ticks.map((t) => (
            <span key={t}>{t >= 1000 ? `₹${(t / 1000).toLocaleString("en-IN")}k` : inr(t)}</span>
          ))}
        </div>
        <div className="relative flex-1">
          {[0, 50, 100].map((p) => (
            <span key={p} aria-hidden className="absolute inset-x-0 border-t border-line" style={{ top: `${p}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label="Sales per day">
            {data.map((d, i) => (
              <button
                key={d.date}
                type="button"
                role="listitem"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${short(d.date)}: ${inr(d.gross)}, ${d.orders} orders`}
                className="group relative flex h-full flex-1 items-end focus-visible:outline-none"
              >
                <span
                  className={cn("block w-full rounded-t-[4px] bg-forest transition-opacity", hover !== null && hover !== i && "opacity-40")}
                  style={{ height: d.gross ? `${Math.max(2, (d.gross / nice) * 100)}%` : "0" }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-14 flex text-[11px] text-ink-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.date} className="flex-1 text-center whitespace-nowrap">
            {i % every === 0 ? short(d.date) : ""}
          </span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-forest">View as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-ink-muted">
            <tr>
              <th className="py-1 font-semibold">Date</th>
              <th className="py-1 font-semibold">Orders</th>
              <th className="py-1 text-right font-semibold">Sales</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-line">
                <td className="py-1">{short(d.date)}</td>
                <td className="py-1">{d.orders}</td>
                <td className="py-1 text-right">{inr(d.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
