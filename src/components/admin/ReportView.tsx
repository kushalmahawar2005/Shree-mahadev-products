"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, IndianRupee, Boxes, ReceiptText, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react";
import { MagicCard } from "@/components/shadcn/magic-card";
import { NumberTicker } from "@/components/shadcn/number-ticker";
import { cn } from "@/lib/utils/cn";
import { ReportInsight } from "./ReportInsight";

const ICONS = { revenue: IndianRupee, orders: ShoppingBag, aov: ReceiptText, stock: Boxes } as const;

/** KPI tile with Magic UI number ticker + trend vs previous period. */
export function KpiTile({ icon, label, value, money, change, note }: { icon: keyof typeof ICONS; label: string; value: number; money?: boolean; change: number | null; note: string }) {
  const Icon = ICONS[icon];
  const up = (change ?? 0) >= 0;
  return (
    <MagicCard className="rounded-2xl" gradientColor="color-mix(in oklab, var(--color-khaki) 22%, transparent)" gradientFrom="var(--color-khaki)" gradientTo="var(--color-forest)">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 sm:p-4">
        <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg sm:grid">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{label}</p>
          <p className="truncate text-lg font-bold tracking-tight text-forest-text tabular-nums sm:text-xl">
            {money && "₹"}
            <NumberTicker value={Math.round(value)} className="text-forest-text" />
          </p>
          {change === null ? (
            <p className="truncate text-[11px] text-ink-muted">{note}</p>
          ) : (
            <p className={cn("flex items-center gap-1 truncate text-[11px] font-semibold", up ? "text-forest-fg" : "text-alert")}>
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {up ? "+" : ""}
              {change}% <span className="font-normal text-ink-muted">vs previous</span>
            </p>
          )}
        </div>
      </div>
    </MagicCard>
  );
}

/** Report switcher (sliding pill), insight + chart, and the raw table on demand. */
export function ReportView({
  reports,
  selected,
  rangeQs,
  rows,
  children,
}: {
  reports: readonly (readonly [string, string])[];
  selected: string;
  rangeQs: string;
  rows: Record<string, unknown>[];
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const title = reports.find(([id]) => id === selected)?.[1];

  return (
    <div className="space-y-4">
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <nav className="flex w-max gap-1 rounded-full border border-line bg-surface p-1" aria-label="Reports">
          {reports.map(([id, label]) => (
            <Link
              key={id}
              href={`/admin/reports?report=${id}&${rangeQs}`}
              scroll={false}
              aria-current={selected === id ? "page" : undefined}
              className={cn(
                "relative inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold whitespace-nowrap transition-colors",
                selected === id ? "text-white" : "text-ink-muted hover:text-forest-fg",
              )}
            >
              {selected === id && (
                <motion.span layoutId="report-pill" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className="relative">{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <MagicCard className="rounded-2xl" gradientColor="color-mix(in oklab, var(--color-khaki) 14%, transparent)" gradientFrom="var(--color-khaki)" gradientTo="var(--color-forest)">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-bold text-forest-text">{title}</h2>
            <span className="text-xs text-ink-muted">
              {rows.length} row{rows.length === 1 ? "" : "s"}
            </span>
          </header>
          {!rows.length ? (
            <p className="px-5 py-14 text-center text-sm text-ink-muted">No data for this period. Try a longer date range.</p>
          ) : (
            <motion.div key={selected} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <ReportInsight report={selected} rows={rows} />
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                aria-expanded={showTable}
                className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs font-semibold text-forest-fg hover:bg-subtle"
              >
                {showTable ? "Hide data table" : "View data table"}
                <ChevronDown className={cn("size-3.5 transition-transform", showTable && "rotate-180")} />
              </button>
              {showTable && <div className="border-t border-line">{children}</div>}
            </motion.div>
          )}
        </section>
      </MagicCard>
    </div>
  );
}
