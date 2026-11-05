"use client";

import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Lightbulb } from "lucide-react";
import { AnimatedCircularProgressBar } from "@/components/shadcn/animated-circular-progress-bar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/chart";

type Row = Record<string, unknown>;
type Datum = { name: string; value: number; extra?: string };

const num = (v: unknown) => Number(v ?? 0) || 0;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const short = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, "")}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `₹${n}`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const day = (d: string) => new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Group rows by a key and sum a numeric field, biggest first. */
function group(rows: Row[], key: (r: Row) => string, field: string, top = 8): Datum[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + num(r[field]));
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

/** Plain-language headline + the right chart for each report. */
export function ReportInsight({ report, rows }: { report: string; rows: Row[] }) {
  if (!rows.length) return null;

  switch (report) {
    case "sales": {
      const total = rows.reduce((s, r) => s + num(r.revenue), 0);
      const best = [...rows].sort((a, b) => num(b.revenue) - num(a.revenue))[0];
      return (
        <Shell insight={`Best day was ${day(String(best.date))} with ${inr(num(best.revenue))}. You average ${inr(total / rows.length)} on days with orders.`}>
          <SalesArea data={rows.map((r) => ({ date: String(r.date).slice(0, 10), revenue: num(r.revenue), orders: num(r.orders) }))} />
        </Shell>
      );
    }
    case "products": {
      const data = group(rows, (r) => `${r.product} · ${r.size}`, "revenue");
      const units = group(rows, (r) => String(r.product), "units", 1)[0];
      return (
        <Shell insight={`${data[0].name} earns the most (${inr(data[0].value)}). Most units sold: ${units.name} (${units.value}).`}>
          <HBars data={data} money />
        </Shell>
      );
    }
    case "places": {
      const states = group(rows, (r) => String(r.state || "Unknown"), "revenue", 50);
      const total = states.reduce((s, d) => s + d.value, 0);
      return (
        <Shell insight={`${pct(states[0].value, total)}% of revenue comes from ${states[0].name}. ${states.length} state${states.length === 1 ? "" : "s"} ordered in this period.`}>
          <HBars data={states.slice(0, 8)} money />
        </Shell>
      );
    }
    case "payments": {
      const orders = rows.reduce((s, r) => s + num(r.orders), 0);
      const cod = rows.find((r) => r.method === "cod");
      const codRto = num(cod?.rto);
      return (
        <Shell
          insight={`COD is ${pct(num(cod?.orders), orders)}% of orders.${cod ? ` ${codRto} COD order${codRto === 1 ? "" : "s"} came back (RTO), that is ${pct(codRto, num(cod.orders))}% of COD.` : ""}`}
        >
          <Donut data={rows.map((r) => ({ name: r.method === "cod" ? "Cash on delivery" : r.method === "payu" ? "Online (PayU)" : String(r.method), value: num(r.orders), extra: inr(num(r.revenue)) }))} unit="orders" />
        </Shell>
      );
    }
    case "customers": {
      const ret = rows.find((r) => r.segment === "Returning");
      const total = rows.reduce((s, r) => s + num(r.customers), 0);
      const rev = rows.reduce((s, r) => s + num(r.revenue), 0);
      return (
        <Shell insight={`${pct(num(ret?.customers), total)}% of buyers came back again, and they brought ${pct(num(ret?.revenue), rev)}% of revenue.`}>
          <Donut data={rows.map((r) => ({ name: String(r.segment), value: num(r.customers), extra: inr(num(r.revenue)) }))} unit="customers" />
        </Shell>
      );
    }
    case "coupons": {
      const used = rows.filter((r) => r.coupon !== "No coupon");
      const orders = rows.reduce((s, r) => s + num(r.orders), 0);
      const withCoupon = used.reduce((s, r) => s + num(r.orders), 0);
      const given = used.reduce((s, r) => s + num(r.discount), 0);
      return (
        <Shell insight={`${pct(withCoupon, orders)}% of orders used a coupon. You gave ${inr(given)} in discounts in this period.`}>
          <HBars data={rows.map((r) => ({ name: String(r.coupon), value: num(r.revenue) }))} money />
        </Shell>
      );
    }
    case "carts": {
      const r = rows[0];
      const data = [
        { name: "Carts started", value: num(r.carts) },
        { name: "Became orders", value: num(r.converted) },
        { name: "Recovered by reminder", value: num(r.recovered) },
      ];
      return (
        <Shell insight={`${pct(num(r.converted), num(r.carts))}% of carts became orders. ${num(r.recovered)} were won back after a reminder.`}>
          <div className="grid items-center gap-6 sm:grid-cols-[160px_1fr]">
            <div className="mx-auto text-center">
              <AnimatedCircularProgressBar value={pct(num(r.converted), num(r.carts))} gaugePrimaryColor="var(--chart-1)" gaugeSecondaryColor="var(--color-subtle)" className="size-36 text-2xl font-bold text-forest-text" />
              <p className="mt-1 text-xs text-ink-muted">Cart to order rate</p>
            </div>
            <HBars data={data} />
          </div>
        </Shell>
      );
    }
    case "utm": {
      const data = group(rows, (r) => String(r.source), "revenue");
      const total = data.reduce((s, d) => s + d.value, 0);
      return (
        <Shell insight={`${data[0].name} brings ${pct(data[0].value, total)}% of revenue. Tag ad and WhatsApp links with UTM so fewer orders land in "Direct / unknown".`}>
          <HBars data={data} money />
        </Shell>
      );
    }
    case "inventory": {
      const data = group(rows, (r) => String(r.title), "value");
      const empty = rows.filter((r) => r.stock_qty !== null && num(r.stock_qty) <= 0).length;
      return (
        <Shell insight={`Most stock value sits in ${data[0]?.name ?? "-"} (${inr(data[0]?.value ?? 0)}).${empty ? ` ${empty} size${empty === 1 ? " is" : "s are"} out of stock.` : ""}`}>
          <HBars data={data.filter((d) => d.value > 0)} money />
        </Shell>
      );
    }
    default:
      return null;
  }
}

function Shell({ insight, children }: { insight: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <p className="flex items-start gap-2.5 rounded-xl border border-warm-line bg-warm px-3.5 py-2.5 text-sm text-ink">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-sale" />
        {insight}
      </p>
      {children}
    </div>
  );
}

const areaConfig = { revenue: { label: "Revenue", color: "var(--chart-1)" }, orders: { label: "Orders", color: "var(--chart-2)" } } satisfies ChartConfig;

function SalesArea({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  const id = useId().replace(/:/g, "");
  return (
    <ChartContainer config={areaConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id={`rev-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} tickFormatter={day} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={short} />
        <ChartTooltip
          cursor={{ strokeDasharray: "4 4" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => (p?.[0] ? day(String(p[0].payload.date)) : "")}
              formatter={(v, name, item) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">Revenue · {item.payload.orders} orders</span>
                  <span className="font-semibold tabular-nums">{name === "revenue" ? inr(Number(v)) : String(v)}</span>
                </span>
              )}
            />
          }
        />
        <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} fill={`url(#rev-${id})`} />
      </AreaChart>
    </ChartContainer>
  );
}

const barConfig = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig;

function HBars({ data, money }: { data: Datum[]; money?: boolean }) {
  const fmt = (n: number) => (money ? short(n) : n.toLocaleString("en-IN"));
  return (
    <ChartContainer config={barConfig} className="aspect-auto w-full" style={{ height: Math.max(120, data.length * 40) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={170}
          tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-subtle)" }}
          content={<ChartTooltipContent hideIndicator formatter={(v) => <span className="font-semibold tabular-nums">{money ? inr(Number(v)) : String(v)}</span>} />}
        />
        <Bar dataKey="value" radius={6} barSize={22}>
          {data.map((d, i) => (
            <Cell key={d.name} fill="var(--chart-1)" fillOpacity={i === 0 ? 1 : 0.45} />
          ))}
          <LabelList dataKey="value" position="right" className="fill-foreground text-xs font-semibold" formatter={(v: unknown) => fmt(Number(v))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function Donut({ data, unit }: { data: Datum[]; unit: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const config = Object.fromEntries(data.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }])) satisfies ChartConfig;
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
      <ChartContainer config={config} className="mx-auto aspect-square h-52">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <text x="50%" y="47%" textAnchor="middle" className="fill-foreground text-2xl font-bold">
            {total}
          </text>
          <text x="50%" y="58%" textAnchor="middle" className="fill-muted-foreground text-xs">
            {unit}
          </text>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-2.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-3.5 py-2.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="flex-1 text-sm font-medium text-ink">{d.name}</span>
            <span className="text-right">
              <span className="block text-sm font-bold text-ink tabular-nums">{pct(d.value, total)}%</span>
              <span className="block text-[11px] text-ink-muted">
                {d.value} {unit}
                {d.extra && ` · ${d.extra}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
