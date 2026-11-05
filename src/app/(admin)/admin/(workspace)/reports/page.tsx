import { connection } from "next/server";
import { Download } from "lucide-react";
import { DateRangeControl } from "@/components/admin/dashboard/DashboardControls";
import { KpiTile, ReportView } from "@/components/admin/ReportView";
import { requireRole } from "@/lib/server/admin-auth";
import { resolveRange } from "@/lib/server/dashboard";
import { getReports } from "@/lib/server/reports";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Reports" };
export const instant = false;

const REPORTS = [
  ["sales", "Sales over time"],
  ["products", "Product & size"],
  ["places", "State & city"],
  ["payments", "Payment & COD RTO"],
  ["customers", "New vs returning"],
  ["coupons", "Coupons"],
  ["carts", "Cart recovery"],
  ["utm", "Revenue by UTM"],
  ["inventory", "Inventory value"],
] as const;

const MONEY = new Set(["revenue", "discount", "discounts", "value"]);
const HEAD: Record<string, string> = { orders_count: "Orders", utm_source: "Source", rto: "RTO" };
const head = (k: string) => HEAD[k] ?? k.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
const cell = (v: unknown, k: string) => (v === null || v === undefined || v === "" ? "-" : MONEY.has(k) ? formatMoney(Number(v)) : String(v));
const isNum = (v: unknown) => v !== null && v !== "" && !Number.isNaN(Number(v));
const sum = (rows: unknown[], k: string) => rows.reduce<number>((s, r) => s + Number((r as Record<string, unknown>)[k] ?? 0), 0);
const change = (now: number, prev: number) => (prev ? Math.round(((now - prev) / prev) * 100) : null);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("owner", "manager");
  await connection();
  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined);
  const range = resolveRange(str("range"), str("from"), str("to"));
  const prevRange = { ...range, from: range.prevFrom, to: range.prevTo, label: `${range.prevFrom} → ${range.prevTo}` };
  const [data, previous] = await Promise.all([getReports(range), getReports(prevRange)]);
  const selected = REPORTS.some(([id]) => id === str("report")) ? str("report")! : "sales";
  const rows = data[selected as keyof typeof data];
  const items = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  const cols = items.length ? Object.keys(items[0]) : [];
  const rangeQs = `range=${range.preset}${range.preset === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`;

  const revenue = sum(data.sales, "revenue");
  const orders = sum(data.sales, "orders");
  const prevRevenue = sum(previous.sales, "revenue");
  const prevOrders = sum(previous.sales, "orders");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {range.label} · compared with the {range.days} days before
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeControl preset={range.preset} from={range.from} to={range.to} />
          <a
            href={`/admin/reports/export?report=${selected}&${rangeQs}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-forest-fg hover:bg-khaki-soft"
          >
            <Download className="size-4" />
            CSV
          </a>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <KpiTile icon="revenue" label="Revenue" value={revenue} money change={change(revenue, prevRevenue)} note="No sales in the previous period" />
        <KpiTile icon="orders" label="Orders" value={orders} change={change(orders, prevOrders)} note="No orders in the previous period" />
        <KpiTile
          icon="aov"
          label="Average order"
          value={orders ? revenue / orders : 0}
          money
          change={orders && prevOrders ? change(revenue / orders, prevRevenue / prevOrders) : null}
          note="Revenue ÷ orders"
        />
        <KpiTile icon="stock" label="Inventory value" value={sum(data.inventory, "value")} money change={null} note="Tracked stock, at selling price" />
      </section>

      <ReportView reports={REPORTS} selected={selected} rangeQs={rangeQs} rows={items}>
        <div className="max-h-[480px] overflow-auto" data-lenis-prevent="">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-xs text-ink-muted">
                {cols.map((k, i) => (
                  <th key={k} className={cn("px-4 py-2.5 font-medium sm:px-5", i && isNum(items[0][k]) ? "text-right" : "text-left")}>
                    {head(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row, r) => (
                <tr key={r} className="border-b border-line last:border-0 hover:bg-subtle">
                  {cols.map((k, i) => (
                    <td key={k} className={cn("px-4 py-2.5 sm:px-5", i && isNum(row[k]) ? "text-right tabular-nums" : "text-ink", MONEY.has(k) && "font-semibold text-ink")}>
                      {cell(row[k], k)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportView>
    </div>
  );
}
