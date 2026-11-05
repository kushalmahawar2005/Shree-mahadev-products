"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/shadcn/chart";
import { cn } from "@/lib/utils/cn";

export type SalesPoint = { date: string; gross: number; orders: number; prevGross: number };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const shortInr = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, "")}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `₹${n}`;
const day = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const salesConfig = {
  gross: { label: "Sales", color: "var(--chart-1)" },
  prevGross: { label: "Previous period", color: "var(--chart-5)" },
  orders: { label: "Orders", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Daily sales area chart with the previous period as a dashed comparison line. */
export function SalesTrendChart({ data }: { data: SalesPoint[] }) {
  const [metric, setMetric] = useState<"gross" | "orders">("gross");
  const gradient = useId().replace(/:/g, "");
  const total = data.reduce((s, d) => s + d.gross, 0);
  const prevTotal = data.reduce((s, d) => s + d.prevGross, 0);
  const orders = data.reduce((s, d) => s + d.orders, 0);
  const empty = total === 0 && prevTotal === 0 && orders === 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <dl className="flex gap-6">
          <div>
            <dt className="text-xs text-ink-muted">Sales</dt>
            <dd className="text-2xl font-bold tracking-tight text-forest-text">{inr(total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Orders</dt>
            <dd className="text-2xl font-bold tracking-tight text-forest-text">{orders}</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-xs text-ink-muted">Previous period</dt>
            <dd className="text-2xl font-bold tracking-tight text-ink-muted">{inr(prevTotal)}</dd>
          </div>
        </dl>
        <div role="tablist" aria-label="Chart metric" className="flex rounded-full border border-line bg-subtle p-1">
          {(["gross", "orders"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={metric === m}
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                metric === m ? "bg-surface text-forest-text shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {m === "gross" ? "Sales" : "Orders"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-5">
        <ChartContainer config={salesConfig} className="aspect-auto h-64 w-full">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${gradient}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${metric})`} stopOpacity={0.35} />
                <stop offset="95%" stopColor={`var(--color-${metric})`} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={24}
              tickFormatter={day}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
              tickFormatter={(v: number) => (metric === "gross" ? shortInr(v) : String(v))}
              domain={[0, (max: number) => Math.max(max, metric === "gross" ? 1000 : 4)]}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => (payload?.[0] ? day(String(payload[0].payload.date)) : "")}
                  formatter={(value, name) => (
                    <span className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">{salesConfig[name as keyof typeof salesConfig]?.label}</span>
                      <span className="font-semibold tabular-nums">
                        {name === "orders" ? String(value) : inr(Number(value))}
                      </span>
                    </span>
                  )}
                />
              }
            />
            {metric === "gross" && (
              <Line
                dataKey="prevGross"
                type="monotone"
                stroke="var(--color-prevGross)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Area
              dataKey={metric}
              type="monotone"
              stroke={`var(--color-${metric})`}
              strokeWidth={2.25}
              fill={`url(#fill-${gradient})`}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
        {empty && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-ink-muted">
            No placed orders in this range yet. Unpaid orders aren&apos;t counted in sales.
          </p>
        )}
      </div>
    </div>
  );
}

/** Tiny trend line for KPI cards. */
export function Sparkline({ values, tone = "forest" }: { values: number[]; tone?: "forest" | "mustard" }) {
  const id = useId().replace(/:/g, "");
  const color = tone === "forest" ? "var(--chart-1)" : "var(--chart-2)";
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ChartContainer config={{ v: { label: "Value", color } }} className="aspect-auto h-10 w-full">
      <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
        <Area dataKey="v" type="monotone" stroke={color} strokeWidth={1.75} fill={`url(#spark-${id})`} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}
