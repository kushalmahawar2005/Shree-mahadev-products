import { cn } from "@/lib/utils/cn";

const rows: [string, string, string][] = [
  ["Heat", "Pressed slowly, no external heat", "High heat, often above 200°C"],
  ["Chemicals", "None. Just seeds and wood", "Solvents like hexane, bleach, deodorisers"],
  ["Nutrients", "Natural nutrients and antioxidants stay in", "Largely stripped during refining"],
  ["Taste & aroma", "Strong, natural taste of the seed", "Neutral, flat"],
  ["Colour", "Natural, may have fine sediment", "Clear, uniform, bleached"],
];

export function ComparisonTable({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius-card)] border border-line", className)}>
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
          {(compact ? rows.slice(0, 3) : rows).map(([k, ours, refined], i) => (
            <tr key={k} className={i % 2 ? "bg-khaki-soft/60" : "bg-white"}>
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
  );
}
