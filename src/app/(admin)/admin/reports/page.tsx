import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Card, Table } from "@/components/admin/ui";
import { requireRole } from "@/lib/server/admin-auth";
import { resolveRange } from "@/lib/server/dashboard";
import { getReports } from "@/lib/server/reports";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Reports" };
export const instant = false;

const reports = [
  ["sales", "Sales over time"], ["products", "Product and size"], ["places", "State and city"],
  ["payments", "Payment and COD RTO"], ["customers", "New vs returning"], ["coupons", "Coupon performance"],
  ["carts", "Abandoned-cart recovery"], ["utm", "Revenue by UTM"], ["inventory", "Inventory value"],
] as const;

function value(value: unknown, key: string) {
  if (["revenue", "discount", "value"].includes(key) && value !== null) return formatMoney(Number(value));
  return String(value ?? "—");
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("owner", "manager");
  await connection();
  const sp = await searchParams;
  const str = (key: string) => typeof sp[key] === "string" ? sp[key] as string : undefined;
  const range = resolveRange(str("range"), str("from"), str("to"));
  const previousRange = { ...range, from: range.prevFrom, to: range.prevTo, label: `${range.prevFrom} → ${range.prevTo}` };
  const [data, previous] = await Promise.all([getReports(range), getReports(previousRange)]);
  const selected = reports.some(([id]) => id === str("report")) ? str("report")! : "sales";
  const rows = data[selected as keyof typeof data];
  const items = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  const headers = items.length ? Object.keys(items[0]) : [];
  const query = (report: string) => `/admin/reports?report=${report}&range=${range.preset}${range.preset === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`;
  return (
    <>
      <PageHeader title="Reports" intro={`${range.label} · compare with ${range.days} previous days`} />
      <div className="flex flex-wrap gap-2">
        {reports.map(([id, label]) => <Link key={id} href={query(id)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selected === id ? "border-forest bg-forest text-white" : "border-line bg-white"}`}>{label}</Link>)}
        <Link href={`/admin/reports/export?report=${selected}&range=${range.preset}${range.preset === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`} className="ml-auto rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest">Download CSV</Link>
      </div>
      <form action="/admin/reports" className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="range" value="custom" />
        <label className="text-sm"><span className="mb-1 block font-semibold">From</span><input type="date" name="from" defaultValue={range.from} className="min-h-10 rounded-xl border border-line px-3" /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">To</span><input type="date" name="to" defaultValue={range.to} className="min-h-10 rounded-xl border border-line px-3" /></label>
        <button className="min-h-10 rounded-full border border-forest px-4 text-sm font-semibold text-forest">Apply dates</button>
      </form>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-muted">Revenue</p><p className="mt-1 text-2xl font-bold">{formatMoney(data.sales.reduce((sum, row) => sum + Number((row as Record<string, unknown>).revenue ?? 0), 0))}</p><p className="text-xs text-ink-muted">Previous: {formatMoney(previous.sales.reduce((sum, row) => sum + Number((row as Record<string, unknown>).revenue ?? 0), 0))}</p></Card>
        <Card><p className="text-sm text-ink-muted">Orders</p><p className="mt-1 text-2xl font-bold">{data.sales.reduce((sum, row) => sum + Number((row as Record<string, unknown>).orders ?? 0), 0)}</p><p className="text-xs text-ink-muted">Previous period compared</p></Card>
        <Card><p className="text-sm text-ink-muted">Inventory value</p><p className="mt-1 text-2xl font-bold">{formatMoney(data.inventory.reduce((sum, row) => sum + Number((row as Record<string, unknown>).value ?? 0), 0))}</p><p className="text-xs text-ink-muted">Tracked stock only</p></Card>
      </div>
      <Card className="mt-6">
        {selected === "carts" && items[0] && <p className="mb-4 text-sm text-ink-muted">Carts: {value(items[0].carts, "carts")} · Converted: {value(items[0].converted, "converted")} · Recovered: {value(items[0].recovered, "recovered")} · Cart value: {value(items[0].value, "value")}</p>}
        {!items.length ? <p className="text-sm text-ink-muted">No data for this period.</p> : <Table head={headers}>{items.map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{value(row[header], header)}</td>)}</tr>)}</Table>}
      </Card>
    </>
  );
}
