import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const rows: [string, string, string][] = [
  ["Heat", "Pressed slowly, no external heat", "High heat, often above 200°C"],
  ["Chemicals", "None. Just seeds and wood", "Solvents like hexane, bleach, deodorisers"],
  ["Nutrients", "Natural nutrients and antioxidants stay in", "Largely stripped during refining"],
  ["Taste & aroma", "Strong, natural taste of the seed", "Neutral, flat"],
  ["Colour", "Natural, may have fine sediment", "Clear, uniform, bleached"],
];

/**
 * Kachi ghani vs refined. sm+: a 3-column table. Phone: one card per factor with the two answers
 * side by side, so nothing is cut off or needs sideways scrolling.
 */
export function ComparisonTable({ compact = false, className }: { compact?: boolean; className?: string }) {
  const list = compact ? rows.slice(0, 3) : rows;
  return (
    <div className={className}>
      {/* Phone */}
      <div className="sm:hidden">
        <div className="mb-2 grid grid-cols-2 gap-2 px-1 text-[11px] font-bold tracking-wide uppercase">
          <span className="text-forest">Kachi ghani (ours)</span>
          <span className="text-ink-muted">Refined oil</span>
        </div>
        <ul className="space-y-2.5">
          {list.map(([k, ours, refined]) => (
            <li key={k} className="rounded-2xl border border-line bg-white p-3">
              <p className="mb-2 text-sm font-bold text-forest-text">{k}</p>
              <div className="grid grid-cols-2 gap-2 text-[13px] leading-snug">
                <p className="flex gap-1.5 rounded-xl bg-forest/[0.06] p-2.5 text-ink">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-forest" strokeWidth={3} aria-hidden />
                  {ours}
                </p>
                <p className="flex gap-1.5 rounded-xl bg-subtle p-2.5 text-ink-muted">
                  <X className="mt-0.5 size-3.5 shrink-0 text-alert/70" strokeWidth={3} aria-hidden />
                  {refined}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* sm+ */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line sm:block">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <caption className="sr-only">Kachi ghani oil compared with refined oil</caption>
          <thead>
            <tr className="bg-forest text-white">
              <th scope="col" className="p-4 font-semibold">
                <span className="sr-only">Factor</span>
              </th>
              <th scope="col" className="p-4 font-semibold">
                Kachi ghani (ours)
              </th>
              <th scope="col" className="p-4 font-semibold text-white/80">
                Refined oil
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map(([k, ours, refined], i) => (
              <tr key={k} className={cn(i % 2 ? "bg-khaki-soft/60" : "bg-white")}>
                <th scope="row" className="p-4 font-semibold text-forest-text">
                  {k}
                </th>
                <td className="p-4 text-ink">{ours}</td>
                <td className="p-4 text-ink-muted">{refined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
