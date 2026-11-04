import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { SalesChart } from "@/components/admin/SalesChart";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { getAttention, getDashboard, resolveRange, type Range } from "@/lib/server/dashboard";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Dashboard" };

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
] as const;

export default function Dashboard({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <PageHeader title="Dashboard" intro="Sales, what needs attention today, and what's selling." />
      <Suspense fallback={<p className="text-ink-muted">Loading dashboard…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const range = resolveRange(str("range"), str("from"), str("to"));
  const data = await Promise.all([getDashboard(range), getAttention()]).catch((e) => (console.error(e), null));
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [d, attention] = data;

  return (
    <div className="space-y-6">
      <RangeBar range={range} />

      {attention.length > 0 && (
        <section aria-labelledby="att" className="rounded-2xl border border-line bg-white p-4 md:p-5">
          <h2 id="att" className="text-lg font-semibold text-forest-text">Needs attention</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {attention.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:border-forest/50">
                  <span className="flex items-center gap-2 text-sm">
                    <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", a.tone === "red" ? "bg-red-600" : a.tone === "amber" ? "bg-mustard" : "bg-ink-muted/50")} />
                    {a.label}
                  </span>
                  {!["fssai", "payu", "resend", "nimbus"].includes(a.key) && <strong className="text-base">{a.count}</strong>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Net sales" value={formatMoney(d.cur.net)} delta={pct(d.cur.net, d.prev.net)} range={range} note={d.cur.refunded ? `after ${formatMoney(d.cur.refunded)} refunds` : undefined} />
        <Kpi label="Orders" value={String(d.cur.orders)} delta={pct(d.cur.orders, d.prev.orders)} range={range} />
        <Kpi label="Average order" value={d.cur.aov === null ? "–" : formatMoney(d.cur.aov)} delta={d.cur.aov && d.prev.aov ? pct(d.cur.aov, d.prev.aov) : null} range={range} note={d.cur.aov === null ? "no orders yet" : undefined} />
        <Kpi label="Customers" value={String(d.cur.customers)} delta={pct(d.cur.customers, d.prev.customers)} range={range} note={`${d.cur.newCustomers} new · ${Math.max(0, d.cur.customers - d.cur.newCustomers)} returning`} />
        <Kpi label="COD share" value={rate(d.cur.codShare)} delta={pp(d.cur.codShare, d.prev.codShare)} neutral range={range} note={d.cur.codShare === null ? "no orders yet" : undefined} />
        <Kpi label="RTO rate" value={rate(d.cur.rtoRate)} delta={pp(d.cur.rtoRate, d.prev.rtoRate)} invert range={range} note={d.cur.rtoRate === null ? "nothing shipped yet" : "of shipped orders"} />
        <Kpi label="Cart → order" value={rate(d.cur.conversion)} delta={pp(d.cur.conversion, d.prev.conversion)} range={range} note={`${d.cur.carts} carts started`} />
        <Kpi label="Abandoned checkouts" value={String(d.cur.abandonedCheckouts)} delta={null} range={range} note={`${d.cur.recovered} recovered after a reminder`} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-4 md:p-5">
        {d.cur.orders ? <SalesChart data={d.series} /> : <p className="text-sm text-ink-muted">No sales in this period yet. The chart appears with the first order.</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Ranked title="Top products by revenue" rows={d.topProducts.map((p) => ({ key: p.handle, label: p.title.replace(/^(Wood|Cold)-Pressed /, ""), sub: `${p.units} sold`, value: p.revenue }))} />
        <Ranked title="Top sizes by units" rows={d.topSizes.map((p) => ({ key: p.title + p.size, label: `${p.title.replace(/^(Wood|Cold)-Pressed /, "")} · ${p.size}`, sub: formatMoney(p.revenue), value: p.units }))} unit="units" />
        <Ranked title="Top places" rows={d.topPlaces.map((p) => ({ key: p.state + p.city, label: `${p.city}, ${p.state}`, sub: `${p.orders} orders`, value: p.revenue }))} />
        <section className="rounded-2xl border border-line bg-white p-4 md:p-5">
          <h2 className="text-lg font-semibold text-forest-text">Recent orders</h2>
          {d.recent.length ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {d.recent.map((o) => {
                const l = ORDER_LABEL[o.status as keyof typeof ORDER_LABEL];
                return (
                  <li key={o.id}>
                    <Link href={`/admin/orders/view?id=${o.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-khaki-soft/40">
                      <span className="min-w-0">
                        <span className="font-semibold text-forest-text">{o.orderNo}</span>
                        <span className="block truncate text-ink-muted">
                          {o.name} · {o.city} · {o.method === "cod" ? "COD" : "PayU"} · {o.at.slice(5, 16)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold">{formatMoney(o.total)}</span>
                        {l && <StatusBadge tone={l.tone}>{l.text}</StatusBadge>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No orders yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

const pct = (a: number, b: number) => (b ? (a - b) / b : a ? Infinity : null);
const pp = (a: number | null, b: number | null) => (a === null || b === null ? null : (a - b) * 100);
const rate = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`);

function RangeBar({ range }: { range: Range }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Link
          key={p.id}
          href={`/admin?range=${p.id}`}
          className={cn("inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold", range.preset === p.id ? "border-forest bg-forest text-white" : "border-line bg-white hover:border-forest/50")}
        >
          {p.label}
        </Link>
      ))}
      <form action="/admin" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" defaultValue={range.from} className="h-10 rounded-full border border-line px-3 text-sm" aria-label="From" />
        <span className="text-ink-muted">→</span>
        <input type="date" name="to" defaultValue={range.to} className="h-10 rounded-full border border-line px-3 text-sm" aria-label="To" />
        <button className={cn("h-10 rounded-full border px-4 text-sm font-semibold", range.preset === "custom" ? "border-forest bg-forest text-white" : "border-forest text-forest")}>Apply</button>
      </form>
      <span className="text-sm text-ink-muted">
        vs {range.prevFrom} → {range.prevTo}
      </span>
    </div>
  );
}

function Kpi({ label, value, delta, note, invert = false, neutral = false, range }: { label: string; value: string; delta: number | null; note?: string; invert?: boolean; neutral?: boolean; range: Range }) {
  const isPp = label.includes("rate") || label.includes("share") || label.includes("→");
  let text = "";
  let tone = "text-ink-muted";
  if (delta === Infinity) {
    text = "new";
  } else if (delta !== null && Number.isFinite(delta)) {
    const v = isPp ? delta : delta * 100;
    const r = Math.round(v * 10) / 10;
    text = `${r > 0 ? "▲" : r < 0 ? "▼" : ""} ${Math.abs(r)}${isPp ? " pts" : "%"}`;
    if (!neutral && r !== 0) tone = (r > 0) !== invert ? "text-forest" : "text-red-700";
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-forest-text">{value}</p>
      <p className="mt-1 text-xs">
        {text ? <span className={cn("font-semibold", tone)}>{text}</span> : <span className="text-ink-muted">–</span>}
        <span className="text-ink-muted"> vs previous {range.days === 1 ? "day" : `${range.days} days`}</span>
      </p>
      {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

function Ranked({ title, rows, unit }: { title: string; rows: { key: string; label: string; sub: string; value: number }[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <section className="rounded-2xl border border-line bg-white p-4 md:p-5">
      <h2 className="text-lg font-semibold text-forest-text">{title}</h2>
      {rows.length ? (
        <ol className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={r.key} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 font-semibold">{unit ? `${r.value} ${unit}` : formatMoney(r.value)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-khaki-soft" aria-hidden>
                  <span className="block h-full rounded-full bg-forest" style={{ width: `${(r.value / max) * 100}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right text-xs text-ink-muted">{r.sub}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No sales in this period yet.</p>
      )}
    </section>
  );
}
