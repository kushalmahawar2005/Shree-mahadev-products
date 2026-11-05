import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  ArrowUpRight,
  CircleCheck,
  IndianRupee,
  MapPin,
  Package,
  PackageCheck,
  Percent,
  Receipt,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { StatusBadge } from "@/components/admin/ui";
import { SalesTrendChart, Sparkline } from "@/components/admin/dashboard/DashboardCharts";
import { DateRangeControl, OrderSearch } from "@/components/admin/dashboard/DashboardControls";
import { NumberTicker } from "@/components/shadcn/number-ticker";
import { Skeleton } from "@/components/shadcn/skeleton";
import {
  getAttention,
  getDashboard,
  getDashboardOperations,
  resolveRange,
} from "@/lib/server/dashboard";
import { getOrderFilterCounts, listOrders, type OrderFilter } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Dashboard" };

const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "needs_action", label: "Needs action" },
  { id: "to_ship", label: "To ship" },
  { id: "awaiting_payment", label: "Unpaid" },
  { id: "shipped", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled / RTO" },
  { id: "all", label: "All orders" },
];

/** Setup/integration alerts live in the "Store setup" card, not the task bar. */
const SETUP_KEYS = ["fssai", "payu", "payu_test", "resend", "nimbus", "mail"];

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";

export default function Dashboard({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<LoadingDashboard />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 bg-surface" />
          <Skeleton className="h-4 w-80 bg-surface" />
        </div>
        <Skeleton className="h-10 w-96 rounded-full bg-surface" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-2xl bg-surface xl:col-span-2" />
        <Skeleton className="h-96 rounded-2xl bg-surface" />
      </div>
    </div>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
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
      <section className="rounded-2xl border border-red-200 bg-surface p-6" role="alert">
        <p className="font-semibold text-red-800">Dashboard data could not be loaded.</p>
        <p className="mt-1 text-sm text-ink-muted">Check the database connection and try refreshing the page.</p>
      </section>
    );
  }

  const tasks = attention.filter((item) => !SETUP_KEYS.includes(item.key));
  const setupAlerts = attention.filter((item) => SETUP_KEYS.includes(item.key));
  const orderHref = (next: { f?: OrderFilter; page?: number }) => {
    const params = new URLSearchParams({ range: range.preset });
    if (range.preset === "custom") {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    params.set("f", next.f ?? filter);
    if (query) params.set("q", query);
    const pageNumber = next.page ?? 1;
    if (pageNumber > 1) params.set("page", String(pageNumber));
    return `/admin?${params.toString()}`;
  };
  const totalPages = Math.max(1, Math.ceil(orderResult.total / orderResult.perPage));
  const { cur, prev, series } = dashboard;
  const vs = `vs previous ${range.days === 1 ? "day" : `${range.days} days`}`;

  return (
    <div className="space-y-6">
      {/* Heading + range */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-forest-text">{greeting()}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {range.label} at a glance. {tasks.length ? `${tasks.length} thing${tasks.length === 1 ? "" : "s"} need your attention.` : "Nothing urgent right now."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeControl preset={range.preset} from={range.from} to={range.to} />
          <Link
            href="/admin/orders?f=needs_action"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid"
          >
            Order desk <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Task bar */}
      {tasks.length > 0 && (
        <section aria-label="Needs your attention" className={cn(card, "border-warm-line bg-warm p-2")}>
          <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tasks.map((item) => (
              <li key={item.key} className="shrink-0">
                <Link
                  href={item.href}
                  className="group flex h-11 items-center gap-2.5 rounded-xl bg-surface px-3.5 text-sm font-medium text-ink ring-1 ring-warm-line transition hover:ring-mustard/70"
                >
                  <span aria-hidden className={cn("size-2 rounded-full", item.tone === "red" ? "bg-red-600" : item.tone === "amber" ? "bg-mustard" : "bg-ink-muted/50")} />
                  {item.label}
                  <span className="rounded-full bg-warm-strong px-2 py-0.5 text-xs font-bold text-sale">{item.count}</span>
                  <ArrowUpRight className="size-3.5 text-ink-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* KPIs */}
      <section aria-label="Store performance" className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi icon={IndianRupee} label="Net sales" value={cur.net} money delta={pct(cur.net, prev.net)} vs={vs} spark={series.map((d) => d.gross)} />
        <Kpi icon={Receipt} label="Orders placed" value={cur.orders} delta={pct(cur.orders, prev.orders)} vs={vs} spark={series.map((d) => d.orders)} sparkTone="mustard" />
        <Kpi icon={ShoppingBag} label="Average order" value={cur.aov} money delta={cur.aov && prev.aov ? pct(cur.aov, prev.aov) : null} vs={vs} note={cur.aov === null ? "No placed orders yet" : undefined} spark={series.map((d) => (d.orders ? d.gross / d.orders : 0))} />
        <Kpi icon={Users} label="Customers" value={cur.customers} delta={pct(cur.customers, prev.customers)} vs={vs} note={`${cur.newCustomers} new this period`} />
        <Kpi icon={Percent} label="Cart conversion" value={cur.conversion === null ? null : Math.round(cur.conversion * 100)} suffix="%" delta={pp(cur.conversion, prev.conversion)} points vs={vs} progress={cur.conversion ?? 0} note={`${cur.convertedCarts} of ${cur.carts} carts ordered`} />
        <Kpi icon={ShoppingCart} label="Abandoned checkouts" value={cur.abandonedCheckouts} delta={null} vs={vs} note={`${cur.recovered} recovered`} href="/admin/abandoned-carts" />
      </section>

      {/* Sales + stock */}
      <div className="grid gap-5 xl:grid-cols-3">
        <section aria-labelledby="sales-title" className={cn(card, "min-w-0 p-5 xl:col-span-2")}>
          <PanelHeading id="sales-title" title="Sales trend" subtitle={`${range.label} · dashed line is the previous ${range.days} days`} href="/admin/reports" action="Reports" />
          <div className="mt-4">
            <SalesTrendChart data={series} />
          </div>
        </section>

        <section aria-labelledby="stock-title" className={cn(card, "flex flex-col p-5")}>
          <PanelHeading id="stock-title" title="Stock watch" href="/admin/inventory" action="Inventory" />
          {operations.lowStock.length ? (
            <ul className="mt-3 flex-1 divide-y divide-line">
              {operations.lowStock.map((item) => (
                <li key={`${item.handle}-${item.variant}`} className="flex items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
                    <Package className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{shortTitle(item.title)}</span>
                    <span className="block text-xs text-ink-muted">{item.variant}</span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", item.stock === 0 ? "bg-red-50 text-red-700" : "bg-warm-strong text-sale")}>
                    {item.stock === 0 ? "Out" : `${item.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanel icon={PackageCheck} text="Every size is well stocked." />
          )}
        </section>
      </div>

      {/* Orders */}
      <section aria-labelledby="orders-title" className={cn(card, "min-w-0 overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div className="flex items-center gap-2">
            <h2 id="orders-title" className="text-base font-bold text-forest-text">Orders</h2>
            <span className="rounded-full bg-khaki-soft px-2.5 py-0.5 text-xs font-semibold text-forest-fg">{orderResult.total}</span>
          </div>
          <Link href="/admin/orders?f=all" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-fg hover:underline">
            All orders <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center">
          <nav
            aria-label="Filter orders"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] [scrollbar-width:none] lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
          >
            {ORDER_FILTERS.map((item) => {
              const on = filter === item.id;
              return (
                <Link
                  key={item.id}
                  href={orderHref({ f: item.id, page: 1 })}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
                    on ? "bg-forest text-white" : "text-ink-muted hover:bg-khaki-soft hover:text-forest-fg",
                  )}
                >
                  {item.label}
                  <span className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold", on ? "bg-white/20" : "bg-khaki-soft text-forest-fg")}>
                    {orderCounts[item.id]}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="lg:ml-auto lg:w-80">
            <OrderSearch initial={query} />
          </div>
        </div>

        {orderResult.orders.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-5 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orderResult.orders.map((order) => {
                    const status = ORDER_LABEL[order.status as keyof typeof ORDER_LABEL];
                    return (
                      <tr key={order.id} className="group relative transition-colors hover:bg-subtle">
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <Link href={`/admin/orders/view?id=${order.id}`} className="font-bold text-forest-fg after:absolute after:inset-0">
                            {order.orderNo}
                          </Link>
                          <span className="mt-0.5 block text-xs text-ink-muted">{dateLabel(order.createdAt)}</span>
                        </td>
                        <td className="max-w-[200px] px-4 py-3.5">
                          <span className="block truncate font-medium text-ink">{order.address.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">{order.address.phone} · {order.address.city}</span>
                        </td>
                        <td className="max-w-[260px] px-4 py-3.5">
                          <span className="block truncate text-ink">{itemsSummary(order.items).main}</span>
                          <span className="mt-0.5 block text-xs text-ink-muted">{itemsSummary(order.items).sub}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-ink-muted">{paymentLabel(order.paymentMethod)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-forest-text">{formatMoney(order.total)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <StatusBadge tone={status?.tone ?? "gray"}>{status?.text ?? order.status}</StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {orderResult.orders.map((order) => {
                const status = ORDER_LABEL[order.status as keyof typeof ORDER_LABEL];
                return (
                  <li key={order.id}>
                    <Link href={`/admin/orders/view?id=${order.id}`} className="block px-5 py-4 transition-colors hover:bg-subtle">
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-bold text-forest-fg">{order.orderNo}</span>
                        <StatusBadge tone={status?.tone ?? "gray"}>{status?.text ?? order.status}</StatusBadge>
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-ink">{order.address.name}</span>
                        <strong className="shrink-0 tabular-nums text-forest-text">{formatMoney(order.total)}</strong>
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">{itemsSummary(order.items).main} · {itemsSummary(order.items).sub}</span>
                      <span className="mt-2 flex justify-between text-xs text-ink-muted">
                        <span>{paymentLabel(order.paymentMethod)} · {order.address.city}</span>
                        <span>{dateLabel(order.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-muted">
              <span>
                Showing {(orderResult.page - 1) * orderResult.perPage + 1}–{Math.min(orderResult.page * orderResult.perPage, orderResult.total)} of {orderResult.total}
              </span>
              <div className="flex gap-2">
                {orderResult.page > 1 && (
                  <Link href={orderHref({ page: orderResult.page - 1 })} scroll={false} className="rounded-full border border-line px-3.5 py-1.5 font-semibold text-forest-text hover:border-forest">
                    Previous
                  </Link>
                )}
                {orderResult.page < totalPages && (
                  <Link href={orderHref({ page: orderResult.page + 1 })} scroll={false} className="rounded-full border border-line px-3.5 py-1.5 font-semibold text-forest-text hover:border-forest">
                    Next
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="px-5 py-12 text-center">
            <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-khaki-soft text-forest-fg">
              <CircleCheck className="size-6" />
            </span>
            <p className="mt-3 font-semibold text-forest-text">{query ? "No matching orders" : filter === "needs_action" || filter === "to_ship" ? "You're all caught up" : "No orders in this view"}</p>
            <p className="mt-1 text-sm text-ink-muted">{query ? "Try another order number, name or phone." : "Pick another filter or open the full order list."}</p>
          </div>
        )}
      </section>

      {/* Secondary panels: equal-height row */}
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <section aria-labelledby="carts-title" className={cn(card, "flex flex-col p-5")}>
          <PanelHeading id="carts-title" title="Abandoned carts" href="/admin/abandoned-carts" action="Recover" />
          {operations.carts.length ? (
            <ul className="mt-3 flex-1 divide-y divide-line">
              {operations.carts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                    <span className="block text-xs text-ink-muted">Idle {timeAgo(c.lastActivityAt)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-forest-text">{formatMoney(c.subtotal)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanel icon={ShoppingCart} text="No carts waiting for a reminder." />
          )}
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
            {cur.abandonedCheckouts} abandoned in range · {cur.recovered} recovered
          </p>
        </section>

        <Ranked
          title="Top products"
          icon={Package}
          rows={dashboard.topProducts.map((p) => ({ key: p.handle, label: shortTitle(p.title), sub: `${p.units} sold`, value: p.revenue }))}
          href="/admin/reports"
        />
        <Ranked
          title="Top locations"
          icon={MapPin}
          rows={dashboard.topPlaces.map((p) => ({ key: p.state + p.city, label: `${p.city}, ${p.state}`, sub: `${p.orders} orders`, value: p.revenue }))}
          href="/admin/reports"
        />

        <section aria-labelledby="setup-title" className={cn(card, "flex flex-col p-5")}>
          <PanelHeading id="setup-title" title="Store setup" href="/admin/settings" action="Settings" />
          {setupAlerts.length ? (
            <ul className="mt-3 space-y-2">
              {setupAlerts.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="flex items-start gap-2.5 rounded-xl bg-warm px-3 py-2.5 text-xs font-medium leading-relaxed text-ink ring-1 ring-warm-line transition hover:ring-mustard/70">
                    <span aria-hidden className={cn("mt-1 size-2 shrink-0 rounded-full", item.tone === "red" ? "bg-red-600" : "bg-mustard")} />
                    <span className="flex-1">
                      {item.label}
                      {item.key === "mail" && ` (${item.count})`}
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanel icon={Settings2} text="Payments, email and courier are all set." />
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  money = false,
  suffix,
  delta,
  points = false,
  vs,
  note,
  spark,
  sparkTone = "forest",
  progress,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  money?: boolean;
  suffix?: string;
  delta: number | null;
  points?: boolean;
  vs: string;
  note?: string;
  spark?: number[];
  sparkTone?: "forest" | "mustard";
  progress?: number;
  href?: string;
}) {
  let trend: React.ReactNode = <span className="text-ink-muted">No change</span>;
  if (delta === Infinity) trend = <span className="font-semibold text-forest-fg">New</span>;
  else if (delta !== null && Number.isFinite(delta)) {
    const n = Math.round(delta * 10) / 10;
    const up = n > 0;
    const Arrow = up ? TrendingUp : TrendingDown;
    trend =
      n === 0 ? (
        <span className="text-ink-muted">No change</span>
      ) : (
        <span className={cn("inline-flex items-center gap-1 font-semibold", up ? "text-forest-fg" : "text-red-700")}>
          <Arrow className="size-3.5" />
          {Math.abs(n)}
          {points ? " pts" : "%"}
        </span>
      );
  } else if (delta === null && value === null) trend = <span className="text-ink-muted">—</span>;

  const hasSpark = spark && spark.some((v) => v > 0);
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
      </span>
      <strong className="mt-2 block truncate text-[26px] font-bold leading-tight tracking-tight text-forest-text">
        {value === null ? (
          "–"
        ) : (
          <>
            {money && "₹"}
            <NumberTicker value={value} />
            {suffix}
          </>
        )}
      </strong>
      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
        {trend}
        <span className="text-ink-muted">{vs}</span>
      </span>
      <span className="mt-3 block h-10">
        {hasSpark ? (
          <Sparkline values={spark} tone={sparkTone} />
        ) : progress !== undefined ? (
          <span className="flex h-full flex-col justify-end gap-1.5">
            <span className="h-1.5 overflow-hidden rounded-full bg-khaki-soft">
              <span className="block h-full rounded-full bg-forest-fg" style={{ width: `${Math.min(100, progress * 100)}%` }} />
            </span>
            {note && <span className="truncate text-[11px] text-ink-muted">{note}</span>}
          </span>
        ) : (
          note && <span className="flex h-full items-end truncate text-[11px] text-ink-muted">{note}</span>
        )}
      </span>
    </>
  );
  const className = cn(card, "block min-w-0 p-4", href && "transition hover:-translate-y-0.5 hover:border-forest/40");
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function PanelHeading({ id, title, subtitle, href, action }: { id: string; title: string; subtitle?: string; href?: string; action?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-bold text-forest-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {href && action && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-forest-fg hover:underline">
          {action} <ArrowUpRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function EmptyPanel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-subtle px-4 py-8 text-center">
      <Icon className="size-5 text-ink-muted" />
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  );
}

function Ranked({ title, icon, rows, href }: { title: string; icon: LucideIcon; rows: { key: string; label: string; sub: string; value: number }[]; href: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const id = `ranked-${title.replaceAll(" ", "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={cn(card, "flex min-w-0 flex-col p-5")}>
      <PanelHeading id={id} title={title} href={href} action="Reports" />
      {rows.length ? (
        <ol className="mt-4 space-y-3.5">
          {rows.slice(0, 5).map((row, i) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-xs font-semibold text-ink-muted">{i + 1}</span>
                  <span className="truncate font-medium text-ink">{row.label}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums text-forest-text">{formatMoney(row.value)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-6">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-khaki-soft">
                  <span className="block h-full rounded-full bg-forest-fg" style={{ width: `${(row.value / max) * 100}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right text-[11px] text-ink-muted">{row.sub}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyPanel icon={icon} text="No completed sales in this range." />
      )}
    </section>
  );
}

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed /, "");
const itemsSummary = (items: { quantity: number; productTitle: string; variantTitle: string }[]) => {
  const [first] = items;
  if (!first) return { main: "—", sub: "" };
  const units = items.reduce((s, i) => s + i.quantity, 0);
  return {
    main: `${first.quantity > 1 ? `${first.quantity} × ` : ""}${shortTitle(first.productTitle)} · ${first.variantTitle}`,
    sub: items.length > 1 ? `+${items.length - 1} more · ${units} units` : `${units} unit${units === 1 ? "" : "s"}`,
  };
};
const pct = (a: number, b: number) => (b ? (a - b) / b : a ? Infinity : null);
const pp = (a: number | null, b: number | null) => (a === null || b === null ? null : (a - b) * 100);
const paymentLabel = (method: string) => (method === "cod" ? "Cash on delivery" : method === "offline" ? "Offline paid" : "Online");
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(date.replace(" ", "T") + "+05:30"));
const timeAgo = (date: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date.replace(" ", "T") + "+05:30").getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
};
