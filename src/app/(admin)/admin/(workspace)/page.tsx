import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { SalesChart } from "@/components/admin/SalesChart";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import {
  getAttention,
  getDashboard,
  getDashboardOperations,
  resolveRange,
  type Range,
} from "@/lib/server/dashboard";
import { getOrderFilterCounts, listOrders, type OrderFilter } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Dashboard" };

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
] as const;

const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "needs_action", label: "Needs action" },
  { id: "to_ship", label: "To ship" },
  { id: "awaiting_payment", label: "Unpaid" },
  { id: "shipped", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled / RTO" },
  { id: "all", label: "All orders" },
];

export default function Dashboard({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <PageHeader
        title="Good day, team"
        intro="Your store at a glance. Orders that need action are first."
        action={
          <Link
            href="/admin/orders?f=needs_action"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-forest px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-deep"
          >
            Open order desk <span className="ml-2" aria-hidden>↗</span>
          </Link>
        }
      />
      <Suspense fallback={<LoadingDashboard />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="h-14 animate-pulse rounded-2xl bg-white" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const str = (key: string) => typeof sp[key] === "string" ? sp[key] as string : "";
  const range = resolveRange(str("range") || undefined, str("from") || undefined, str("to") || undefined);
  const filter = (ORDER_FILTERS.some((item) => item.id === str("f")) ? str("f") : "needs_action") as OrderFilter;
  const query = str("q").slice(0, 60);
  const page = Math.max(1, Number(str("page")) || 1);

  const [dashboard, attention, orderResult, operations, orderCounts] = await Promise.all([
    getDashboard(range),
    getAttention(),
    listOrders({ filter, page, perPage: 10, q: query }),
    getDashboardOperations(),
    getOrderFilterCounts(),
  ]).catch((error) => {
    console.error("Dashboard data could not be loaded", error);
    return [null, null, null, null, null] as const;
  });

  if (!dashboard || !attention || !orderResult || !operations || !orderCounts) {
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm" role="alert">
        <p className="font-semibold text-red-800">Dashboard data could not be loaded.</p>
        <p className="mt-1 text-sm text-ink-muted">Check the database connection and try refreshing the page.</p>
      </section>
    );
  }

  const attentionByKey = new Map(attention.map((item) => [item.key, item]));
  const integrationAlerts = attention.filter((item) => ["payu", "payu_test", "resend", "nimbus", "fssai"].includes(item.key));
  const orderHref = (next: { f?: OrderFilter; q?: string; page?: number }) => {
    const params = new URLSearchParams({ range: range.preset });
    if (range.preset === "custom") {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    params.set("f", next.f ?? filter);
    const search = next.q ?? query;
    if (search) params.set("q", search);
    const pageNumber = next.page ?? 1;
    if (pageNumber > 1) params.set("page", String(pageNumber));
    return `/admin?${params.toString()}`;
  };
  const totalPages = Math.max(1, Math.ceil(orderResult.total / orderResult.perPage));

  return (
    <div className="space-y-6">
      <RangeBar range={range} filter={filter} query={query} />

      {attention.length > 0 && (
        <section aria-labelledby="attention-title" className="overflow-hidden rounded-2xl border border-[#ead7ab] bg-[#fffaf0] shadow-[0_6px_24px_-20px_rgba(90,65,12,.45)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eee2c8] px-4 py-3 md:px-5">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-[#f4e8c9] text-[#8b6616]">!</span>
              <div>
                <h2 id="attention-title" className="text-sm font-bold text-forest-text">Needs your attention</h2>
                <p className="text-xs text-ink-muted">Live tasks across your store</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-muted">{attention.length} item{attention.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4 md:p-4">
            {attention.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="group flex min-h-[54px] items-center gap-3 rounded-xl border border-[#eee3ce] bg-white px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-[#cbb171] hover:shadow-sm">
                  <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", item.tone === "red" ? "bg-red-600" : item.tone === "amber" ? "bg-mustard" : "bg-ink-muted/40")} />
                  <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">{item.label}</span>
                  {!(["fssai", "payu", "payu_test", "resend", "nimbus"].includes(item.key)) && <strong className="text-sm text-forest-text">{item.count}</strong>}
                  <span aria-hidden className="text-ink-muted transition group-hover:translate-x-0.5">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Store performance" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Net sales" value={formatMoney(dashboard.cur.net)} delta={pct(dashboard.cur.net, dashboard.prev.net)} range={range} note={dashboard.cur.refunded ? `${formatMoney(dashboard.cur.refunded)} refunded` : undefined} accent />
        <Kpi label="Orders placed" value={String(dashboard.cur.orders)} delta={pct(dashboard.cur.orders, dashboard.prev.orders)} range={range} note="Does not include unpaid orders" />
        <Kpi label="Average order" value={dashboard.cur.aov === null ? "–" : formatMoney(dashboard.cur.aov)} delta={dashboard.cur.aov && dashboard.prev.aov ? pct(dashboard.cur.aov, dashboard.prev.aov) : null} range={range} note={dashboard.cur.aov === null ? "No placed orders in range" : undefined} />
        <Kpi label="Customers" value={String(dashboard.cur.customers)} delta={pct(dashboard.cur.customers, dashboard.prev.customers)} range={range} note={`${dashboard.cur.newCustomers} new customers`} />
        <Kpi label="Cart conversion" value={rate(dashboard.cur.conversion)} delta={pp(dashboard.cur.conversion, dashboard.prev.conversion)} range={range} note={`${dashboard.cur.convertedCarts} of ${dashboard.cur.carts} carts converted`} percentage />
        <Kpi label="Abandoned checkouts" value={String(dashboard.cur.abandonedCheckouts)} delta={null} range={range} note={`${dashboard.cur.recovered} recovered`} href="/admin/abandoned-carts" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
        <section aria-labelledby="orders-title" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_28px_-24px_rgba(14,54,35,.4)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="orders-title" className="text-lg font-bold text-forest-text">Orders workspace</h2>
                <span className="rounded-full bg-khaki-soft px-2.5 py-1 text-xs font-semibold text-forest">{orderResult.total} matching</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">Open an order to view payment, fulfilment and customer details.</p>
            </div>
            <Link href="/admin/orders?f=all" className="text-sm font-semibold text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">Full orders page ↗</Link>
          </div>

          <nav aria-label="Filter dashboard orders" className="flex gap-2 overflow-x-auto border-b border-line px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-5">
            {ORDER_FILTERS.map((item) => (
              <Link key={item.id} href={orderHref({ f: item.id, page: 1 })} aria-current={filter === item.id ? "page" : undefined} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors", filter === item.id ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted hover:border-forest/40 hover:text-forest")}>
                {item.label}
                <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold", filter === item.id ? "bg-white/15 text-white" : "bg-khaki-soft text-forest")}>{orderCounts[item.id]}</span>
              </Link>
            ))}
          </nav>

          <form action="/admin" className="flex gap-2 border-b border-line bg-[#fcfbf8] p-3 md:px-5">
            <input type="hidden" name="range" value={range.preset} />
            {range.preset === "custom" && <><input type="hidden" name="from" value={range.from} /><input type="hidden" name="to" value={range.to} /></>}
            <input type="hidden" name="f" value={filter} />
            <input name="q" defaultValue={query} placeholder="Search order, customer or phone" aria-label="Search dashboard orders" className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10" />
            <button className="min-h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-forest-text transition hover:border-forest hover:bg-khaki-soft">Search</button>
            <Link href={orderHref({ q: "", page: 1 })} className="hidden min-h-10 items-center rounded-xl px-3 text-sm text-ink-muted hover:bg-khaki-soft sm:inline-flex">Reset</Link>
          </form>

          {orderResult.orders.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-[#f8f7f2] text-xs uppercase tracking-wide text-ink-muted">
                    <tr><th className="px-5 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Items</th><th className="px-4 py-3 font-semibold">Payment</th><th className="px-4 py-3 text-right font-semibold">Total</th><th className="px-5 py-3 text-right font-semibold">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line/80">
                    {orderResult.orders.map((order) => {
                      const label = ORDER_LABEL[order.status as keyof typeof ORDER_LABEL];
                      return (
                        <tr key={order.id} className="group transition-colors hover:bg-[#fbfaf6]">
                          <td className="whitespace-nowrap px-5 py-3.5"><Link href={`/admin/orders/view?id=${order.id}`} className="font-bold text-forest underline decoration-transparent underline-offset-4 group-hover:decoration-forest">{order.orderNo}</Link><span className="mt-0.5 block text-xs text-ink-muted">{dateLabel(order.createdAt)}</span></td>
                          <td className="max-w-[190px] px-4 py-3.5"><span className="block truncate font-medium">{order.address.name}</span><span className="mt-0.5 block truncate text-xs text-ink-muted">{order.address.phone} · {order.address.city}</span></td>
                          <td className="max-w-[190px] px-4 py-3.5 text-xs leading-relaxed text-ink-muted">{order.items.slice(0, 2).map((item) => `${item.quantity} × ${item.productTitle} (${item.variantTitle})`).join(" · ")}{order.items.length > 2 ? ` · +${order.items.length - 2} more` : ""}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-ink-muted">{paymentLabel(order.paymentMethod)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-forest-text">{formatMoney(order.total)}</td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right"><StatusBadge tone={label?.tone ?? "gray"}>{label?.text ?? order.status}</StatusBadge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line md:hidden">
                {orderResult.orders.map((order) => {
                  const label = ORDER_LABEL[order.status as keyof typeof ORDER_LABEL];
                  return (
                    <li key={order.id}>
                      <Link href={`/admin/orders/view?id=${order.id}`} className="block px-4 py-4 transition-colors hover:bg-[#fbfaf6]">
                        <span className="flex items-center justify-between gap-3"><span className="font-bold text-forest-text">{order.orderNo}</span><StatusBadge tone={label?.tone ?? "gray"}>{label?.text ?? order.status}</StatusBadge></span>
                        <span className="mt-1.5 flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium">{order.address.name}</span><strong className="shrink-0 text-forest-text">{formatMoney(order.total)}</strong></span>
                        <span className="mt-1 block truncate text-xs text-ink-muted">{order.items.slice(0, 2).map((item) => `${item.quantity} × ${item.productTitle} (${item.variantTitle})`).join(" · ")}</span>
                        <span className="mt-2 flex justify-between text-xs text-ink-muted"><span>{paymentLabel(order.paymentMethod)} · {order.address.city}</span><span>{dateLabel(order.createdAt)}</span></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#fcfbf8] px-4 py-3 text-xs text-ink-muted md:px-5">
                <span>Showing {(orderResult.page - 1) * orderResult.perPage + 1}–{Math.min(orderResult.page * orderResult.perPage, orderResult.total)} of {orderResult.total}</span>
                <div className="flex gap-2">
                  {orderResult.page > 1 && <Link href={orderHref({ page: orderResult.page - 1 })} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold text-forest-text hover:border-forest">Previous</Link>}
                  {orderResult.page < totalPages && <Link href={orderHref({ page: orderResult.page + 1 })} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold text-forest-text hover:border-forest">Next</Link>}
                </div>
              </div>
            </>
          ) : (
            <div className="px-5 py-10 text-center">
              <span aria-hidden className="mx-auto grid size-11 place-items-center rounded-full bg-khaki-soft text-xl text-forest">✓</span>
              <p className="mt-3 font-semibold text-forest-text">{query ? "No matching orders" : filter === "to_ship" ? "You're all caught up" : "No orders in this view"}</p>
              <p className="mt-1 text-sm text-ink-muted">{query ? "Try another order number, customer name or phone." : "Choose another status filter or check the full order list."}</p>
              <Link href={orderHref({ f: "all", q: "", page: 1 })} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-forest hover:bg-khaki-soft">View all orders</Link>
            </div>
          )}
        </section>

        <aside className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <section aria-labelledby="stock-title" className="rounded-2xl border border-line bg-white p-4 shadow-[0_8px_28px_-24px_rgba(14,54,35,.4)] md:p-5">
            <PanelHeading id="stock-title" title="Stock watch" href="/admin/inventory" action="Manage inventory" />
            {operations.lowStock.length ? (
              <ul className="mt-3 divide-y divide-line/80">
                {operations.lowStock.map((item) => <li key={`${item.handle}-${item.variant}`} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{item.title}</span><span className="mt-0.5 block text-xs text-ink-muted">{item.variant}</span></span><span className={cn("shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold", item.stock === 0 ? "bg-red-50 text-red-700" : "bg-[#fff5dc] text-[#805a09]")}>{item.stock === 0 ? "Out" : `${item.stock} left`}</span></li>)}
              </ul>
            ) : <EmptyPanel text="No low-stock variants right now." href="/admin/inventory" link="View inventory" />}
          </section>

          <section aria-labelledby="carts-title" className="rounded-2xl border border-line bg-white p-4 shadow-[0_8px_28px_-24px_rgba(14,54,35,.4)] md:p-5">
            <PanelHeading id="carts-title" title="Abandoned carts" href="/admin/abandoned-carts" action="Recover carts" />
            {operations.carts.length ? (
              <ul className="mt-3 divide-y divide-line/80">
                {operations.carts.map((cart) => <li key={cart.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{cart.name}</span><span className="mt-0.5 block text-xs text-ink-muted">Idle {timeAgo(cart.lastActivityAt)}</span></span><span className="shrink-0 text-sm font-bold text-forest-text">{formatMoney(cart.subtotal)}</span></li>)}
              </ul>
            ) : <EmptyPanel text="No reachable carts need a reminder." href="/admin/abandoned-carts" link="Open cart recovery" />}
            <p className="mt-2 border-t border-line pt-3 text-xs text-ink-muted">{dashboard.cur.abandonedCheckouts} checkout{dashboard.cur.abandonedCheckouts === 1 ? "" : "s"} abandoned in selected dates · {dashboard.cur.recovered} recovered</p>
          </section>

          <section aria-labelledby="health-title" className="rounded-2xl border border-line bg-white p-4 shadow-[0_8px_28px_-24px_rgba(14,54,35,.4)] md:p-5">
            <PanelHeading id="health-title" title="Store setup & delivery" href="/admin/settings" action="Check settings" />
            {integrationAlerts.length ? (
              <ul className="mt-3 space-y-2">
                {integrationAlerts.map((item) => <li key={item.key}><Link href={item.href} className="flex items-start gap-2.5 rounded-xl bg-[#fffaf0] px-3 py-2.5 text-xs font-medium leading-relaxed text-ink transition hover:bg-[#f7efdc]"><span aria-hidden className={cn("mt-1 size-2 shrink-0 rounded-full", item.tone === "red" ? "bg-red-600" : "bg-mustard")} />{item.label}<span aria-hidden className="ml-auto text-ink-muted">↗</span></Link></li>)}
              </ul>
            ) : <EmptyPanel text="Payments, email and courier setup look ready." href="/admin/settings" link="Review settings" />}
            {attentionByKey.has("mail") && <Link href="/admin/settings" className="mt-2 block rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800">{attentionByKey.get("mail")?.count} failed order email{attentionByKey.get("mail")?.count === 1 ? "" : "s"} · Review email setup ↗</Link>}
          </section>
        </aside>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <section aria-labelledby="sales-title" className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-[0_8px_28px_-24px_rgba(14,54,35,.4)] md:p-5">
          <PanelHeading id="sales-title" title="Sales trend" subtitle={`${range.label} · compared with previous ${range.days} days`} />
          {dashboard.cur.orders ? <div className="mt-4"><SalesChart data={dashboard.series} /></div> : <div className="mt-4 rounded-xl bg-[#f8f7f2] px-4 py-5"><p className="text-sm font-semibold text-forest-text">No placed orders in this date range yet.</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">Unpaid orders appear in the order workspace but are not included in net sales.</p><Link href={orderHref({ f: "all", page: 1 })} className="mt-3 inline-flex text-sm font-semibold text-forest underline underline-offset-4">Review all orders ↗</Link></div>}
        </section>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Ranked title="Top products" rows={dashboard.topProducts.map((p) => ({ key: p.handle, label: p.title.replace(/^(Wood|Cold)-Pressed /, ""), sub: `${p.units} sold`, value: p.revenue }))} href="/admin/reports" />
          <Ranked title="Top locations" rows={dashboard.topPlaces.map((p) => ({ key: p.state + p.city, label: `${p.city}, ${p.state}`, sub: `${p.orders} orders`, value: p.revenue }))} href="/admin/reports" />
        </div>
      </section>
    </div>
  );
}

function RangeBar({ range, filter, query }: { range: Range; filter: OrderFilter; query: string }) {
  return (
    <section aria-label="Dashboard date range" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-3 py-3 shadow-sm sm:px-4">
      <div className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PRESETS.map((preset) => (
          <Link key={preset.id} href={rangeHref(range, preset.id, filter, query)} aria-current={range.preset === preset.id ? "date" : undefined} className={cn("inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold transition-colors", range.preset === preset.id ? "bg-forest text-white shadow-sm" : "text-ink-muted hover:bg-khaki-soft hover:text-forest")}>{preset.label}</Link>
        ))}
      </div>
      <form action="/admin" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="range" value="custom" />
        <input type="hidden" name="f" value={filter} />
        {query && <input type="hidden" name="q" value={query} />}
        <input type="date" name="from" defaultValue={range.from} aria-label="From" className="h-9 rounded-lg border border-line px-2.5 text-xs text-ink" />
        <span className="text-xs text-ink-muted">to</span>
        <input type="date" name="to" defaultValue={range.to} aria-label="To" className="h-9 rounded-lg border border-line px-2.5 text-xs text-ink" />
        <button className="h-9 rounded-lg border border-line px-3 text-xs font-semibold text-forest hover:border-forest hover:bg-khaki-soft">Apply</button>
      </form>
    </section>
  );
}

function rangeHref(range: Range, preset: string, filter: OrderFilter, query: string) {
  const params = new URLSearchParams({ range: preset });
  params.set("f", filter);
  if (query) params.set("q", query);
  if (preset === "custom") {
    params.set("from", range.from);
    params.set("to", range.to);
  }
  return `/admin?${params.toString()}`;
}

function Kpi({ label, value, delta, note, range, accent = false, percentage = false, href }: { label: string; value: string; delta: number | null; note?: string; range: Range; accent?: boolean; percentage?: boolean; href?: string }) {
  const isPoints = percentage;
  let trend = "–";
  let trendClass = "text-ink-muted";
  if (delta === Infinity) { trend = "New"; trendClass = "text-forest"; }
  else if (delta !== null && Number.isFinite(delta)) {
    const n = Math.round(delta * 10) / 10;
    trend = `${n > 0 ? "↑ " : n < 0 ? "↓ " : ""}${Math.abs(n)}${isPoints ? " pts" : "%"}`;
    trendClass = n > 0 ? "text-forest" : n < 0 ? "text-red-700" : "text-ink-muted";
  }
  const body = <><span className="flex items-start justify-between gap-2"><span className="text-xs font-medium text-ink-muted">{label}</span>{href && <span aria-hidden className="text-xs text-ink-muted">↗</span>}</span><strong className={cn("mt-2 block truncate text-[22px] font-bold tracking-tight", accent ? "text-forest" : "text-forest-text")}>{value}</strong><span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[10px] leading-snug"><span className={cn("font-bold", trendClass)}>{trend}</span><span className="text-ink-muted">vs previous {range.days === 1 ? "day" : `${range.days} days`}</span></span>{note && <span className="mt-1 block truncate text-[10px] text-ink-muted">{note}</span>}</>;
  const className = cn("block min-w-0 rounded-2xl border bg-white p-3.5 shadow-[0_5px_18px_-16px_rgba(10,54,32,.55)] sm:p-4", accent ? "border-[#b6cabb]" : "border-line", href && "transition hover:-translate-y-0.5 hover:shadow-md");
  return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

function PanelHeading({ id, title, subtitle, href, action }: { id: string; title: string; subtitle?: string; href?: string; action?: string }) {
  return <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 id={id} className="text-base font-bold text-forest-text">{title}</h2>{subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}</div>{href && action && <Link href={href} className="shrink-0 pt-0.5 text-xs font-semibold text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">{action}</Link>}</div>;
}

function EmptyPanel({ text, href, link }: { text: string; href: string; link: string }) {
  return <div className="mt-3 rounded-xl bg-[#f8f7f2] p-3.5"><p className="text-sm text-ink-muted">{text}</p><Link href={href} className="mt-2 inline-flex text-xs font-semibold text-forest underline underline-offset-4">{link} ↗</Link></div>;
}

function Ranked({ title, rows, href }: { title: string; rows: { key: string; label: string; sub: string; value: number }[]; href: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-[0_8px_28px_-24px_rgba(14,54,35,.4)] md:p-5">
      <PanelHeading id={`ranked-${title.replaceAll(" ", "-").toLowerCase()}`} title={title} href={href} action="Reports" />
      {rows.length ? <ol className="mt-3 space-y-3">{rows.slice(0, 5).map((row) => <li key={row.key}><div className="flex justify-between gap-3 text-xs"><span className="truncate font-medium">{row.label}</span><span className="shrink-0 font-bold text-forest-text">{formatMoney(row.value)}</span></div><div className="mt-1.5 flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-khaki-soft"><span className="block h-full rounded-full bg-forest" style={{ width: `${(row.value / max) * 100}%` }} /></span><span className="w-16 shrink-0 text-right text-[10px] text-ink-muted">{row.sub}</span></div></li>)}</ol> : <p className="mt-3 rounded-xl bg-[#f8f7f2] p-3 text-xs leading-relaxed text-ink-muted">No completed sales in this period. <Link href={href} className="font-semibold text-forest underline underline-offset-2">Browse reports</Link> or change the date range.</p>}
    </section>
  );
}

const pct = (a: number, b: number) => (b ? (a - b) / b : a ? Infinity : null);
const pp = (a: number | null, b: number | null) => a === null || b === null ? null : (a - b) * 100;
const rate = (value: number | null) => value === null ? "–" : `${Math.round(value * 100)}%`;
const paymentLabel = (method: string) => method === "cod" ? "Cash on delivery" : method === "offline" ? "Offline paid" : "Online payment";
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(date.replace(" ", "T") + "+05:30"));
const timeAgo = (date: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date.replace(" ", "T") + "+05:30").getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
};
