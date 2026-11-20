import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { getOrderFilterCounts, listOrders, ORDER_PAYS, ORDER_SORTS, type OrderFilter, type OrderPay, type OrderSort } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { OrdersBulkBar, SelectAllOrders } from "@/components/admin/OrdersBulkBar";
import { OrdersDateFilter } from "@/components/admin/OrdersDateFilter";
import { OrdersViewControls } from "@/components/admin/OrdersViewControls";
import { requireAdmin } from "@/lib/server/admin-auth";
import { ProviderTag } from "@/components/admin/ProviderTag";

export const metadata = { title: "Orders" };

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "needs_action", label: "Needs action" },
  { id: "to_ship", label: "To ship" },
  { id: "shipped", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "awaiting_payment", label: "Unpaid" },
  { id: "cancelled", label: "Cancelled / RTO" },
  { id: "all", label: "All orders" },
];
const INVOICE_STATUSES = new Set(["cod_pending", "paid", "confirmed", "packed", "shipped", "delivered"]);

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <PageHeader
        title="Orders"
        intro="Track every order, payment and delivery from one place."
        action={<Link href="/admin?f=needs_action" className="inline-flex min-h-11 items-center rounded-xl bg-forest px-4 text-sm font-semibold text-white shadow-sm hover:bg-forest-deep">Dashboard overview ↗</Link>}
      />
      <Suspense fallback={<OrdersLoading />}>
        <OrdersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function OrdersLoading() {
  return <div className="space-y-4" aria-label="Loading orders"><div className="h-12 animate-pulse rounded-xl bg-surface" /><div className="h-64 animate-pulse rounded-2xl bg-surface" /></div>;
}

async function OrdersTable({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  const sp = await searchParams;
  const str = (key: string) => typeof sp[key] === "string" ? sp[key] as string : "";
  const filter = (FILTERS.some((item) => item.id === str("f")) ? str("f") : "needs_action") as OrderFilter;
  const page = Math.max(Number(str("page")) || 1, 1);
  const query = str("q").slice(0, 60);
  const day = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(k)) ? str(k) : "");
  const from = day("from");
  const to = day("to") || from;
  const time = (k: string) => (from && /^([01]\d|2[0-3]):[0-5]\d$/.test(str(k)) ? str(k) : "");
  const fromTime = time("ft");
  const toTime = time("tt");
  const sort = (ORDER_SORTS.includes(str("sort") as OrderSort) ? str("sort") : "") as OrderSort | "";
  const pay = (ORDER_PAYS.includes(str("pay") as OrderPay) ? str("pay") : "all") as OrderPay;
  const per = [25, 50, 100].includes(Number(str("per"))) ? Number(str("per")) : 25;
  const scope = { from, to, fromTime: fromTime || undefined, toTime: toTime || undefined, pay };
  const canExport = (await requireAdmin()).role !== "staff";
  const [result, counts] = await Promise.all([
    listOrders({ filter, page, perPage: per, q: query, sort: sort || undefined, ...scope }),
    getOrderFilterCounts(scope),
  ]).catch((error) => {
    console.error("Orders could not be loaded", error);
    return [null, null] as const;
  });

  if (!result || !counts) return <DataError />;

  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
  const href = (changes: { f?: OrderFilter; q?: string; page?: number }) => {
    const params = new URLSearchParams({ f: changes.f ?? filter });
    const q = changes.q ?? query;
    if (q) params.set("q", q);
    if (from) {
      params.set("from", from);
      params.set("to", to);
      if (fromTime) params.set("ft", fromTime);
      if (toTime) params.set("tt", toTime);
    }
    if (sort) params.set("sort", sort);
    if (pay !== "all") params.set("pay", pay);
    if (per !== 25) params.set("per", String(per));
    const nextPage = changes.page ?? 1;
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/orders?${params.toString()}`;
  };

  return (
    <>
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <OrdersDateFilter from={from} to={to} fromTime={fromTime} toTime={toTime} />
          <OrdersViewControls sort={sort} pay={pay} per={per} />
        </div>
        <nav aria-label="Filter orders" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => (
            <Link key={item.id} href={href({ f: item.id, page: 1 })} aria-current={filter === item.id ? "page" : undefined} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors", filter === item.id ? "border-forest bg-forest text-white shadow-sm" : "border-line bg-surface text-ink-muted hover:border-forest/40 hover:text-forest-fg")}>
              {item.label}<span className={cn("rounded-md px-1.5 py-0.5 text-[10px] tabular-nums", filter === item.id ? "bg-white/15 text-white" : "bg-khaki-soft text-forest-fg")}>{counts[item.id]}</span>
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <form action="/admin/orders" className="flex min-w-0 flex-1 gap-2">
            <input type="hidden" name="f" value={filter} />
            {from && <input type="hidden" name="from" value={from} />}
            {from && <input type="hidden" name="to" value={to} />}
            {fromTime && <input type="hidden" name="ft" value={fromTime} />}
            {toTime && <input type="hidden" name="tt" value={toTime} />}
            {sort && <input type="hidden" name="sort" value={sort} />}
            {pay !== "all" && <input type="hidden" name="pay" value={pay} />}
            {per !== 25 && <input type="hidden" name="per" value={per} />}
            <input name="q" defaultValue={query} placeholder="Order no., phone or customer name" aria-label="Search orders" className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-subtle px-3.5 text-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10 sm:max-w-md" />
            <button className="min-h-10 shrink-0 rounded-xl bg-forest px-4 text-sm font-semibold text-white transition hover:bg-forest-deep">Search</button>
            {query && <Link href={href({ q: "", page: 1 })} className="inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-khaki-soft">Clear</Link>}
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 sm:justify-end sm:border-0 sm:pt-0">
            <span className="text-xs text-ink-muted">
              {result.total} order{result.total === 1 ? "" : "s"} · <b className="font-semibold text-ink tabular-nums">{formatMoney(result.value)}</b> in this view
            </span>
            {canExport && <a
              href={`/admin/orders/export?${new URLSearchParams({
                f: filter,
                ...(query ? { q: query } : {}),
                ...(from ? { from, to } : {}),
                ...(fromTime ? { ft: fromTime } : {}),
                ...(toTime ? { tt: toTime } : {}),
                ...(sort ? { sort } : {}),
                ...(pay !== "all" ? { pay } : {}),
              }).toString()}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-forest px-4 text-sm font-semibold text-forest-fg hover:bg-khaki-soft"
            >
              Download CSV
            </a>}
          </div>
        </div>
      </div>

      {result.orders.length ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
                <colgroup><col className="w-[4%]" /><col className="w-[9%]" /><col className="w-[12%]" /><col className="w-[17%]" /><col className="w-[26%]" /><col className="w-[12%]" /><col className="w-[8%]" /><col className="w-[12%]" /></colgroup>
                <thead className="border-b border-line bg-subtle text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                  <tr><th className="px-3 py-3 text-center font-bold"><SelectAllOrders /></th><th className="px-3 py-3 font-bold">Order</th><th className="px-3 py-3 font-bold">Placed</th><th className="px-3 py-3 font-bold">Customer</th><th className="px-3 py-3 font-bold">Items</th><th className="px-3 py-3 font-bold">Payment</th><th className="px-3 py-3 text-right font-bold">Total</th><th className="px-3 py-3 text-right font-bold">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-line/80">
                  {result.orders.map((order) => <OrderRow key={order.id} order={order} />)}
                </tbody>
              </table>
            </div>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm md:hidden">
            {result.orders.map((order) => {
              const label = ORDER_LABEL[order.status as keyof typeof ORDER_LABEL];
              return (
                <li key={order.id}>
                  <div className="flex items-start gap-3 p-4">
                    <label className="grid min-h-11 min-w-11 place-items-center"><input className="order-select size-5 accent-[var(--color-forest)]" type="checkbox" value={order.id} data-invoice={INVOICE_STATUSES.has(order.status) ? "1" : "0"} data-status={order.status} aria-label={`Select ${order.orderNo}`} /></label>
                    <Link href={`/admin/orders/view?id=${order.id}`} className="min-w-0 flex-1 rounded-lg focus-visible:outline">
                      <span className="flex items-center justify-between gap-2"><span className="font-bold text-forest-text">{order.orderNo}{order.attention && <span title={order.attention} className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">⚠ Attention</span>}</span><StatusBadge tone={label?.tone ?? "gray"}>{label?.text ?? order.status}</StatusBadge></span>
                      <span className="mt-1.5 flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-ink">{order.address.name}</span><strong className="shrink-0 text-sm text-forest-text">{formatMoney(order.total)}</strong></span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-ink-muted">{itemsLabel(order.items)}</span>
                      <span className="mt-2 flex flex-wrap justify-between gap-1 text-[11px] text-ink-muted"><span>{order.address.phone} · {order.address.city}</span><span>{dateLabel(order.createdAt)} · {paymentLabel(order.paymentMethod)}</span></span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={result.page} pages={totalPages} total={result.total} perPage={result.perPage} href={href} />
          <OrdersBulkBar />
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-surface px-5 py-12 text-center shadow-sm">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-khaki-soft text-xl text-forest-fg">✓</span>
          <p className="mt-3 font-semibold text-forest-text">{query ? "No matching orders" : filter === "needs_action" ? "You're all caught up" : "No orders in this view"}</p>
          <p className="mt-1 text-sm text-ink-muted">{query ? "Try another order number, customer name or phone." : "Choose another status filter to see more orders."}</p>
          <Link href={href({ f: "all", q: "", page: 1 })} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-forest-fg hover:bg-khaki-soft">View all orders</Link>
        </div>
      )}
    </>
  );
}

function OrderRow({ order }: { order: Awaited<ReturnType<typeof listOrders>>["orders"][number] }) {
  const label = ORDER_LABEL[order.status as keyof typeof ORDER_LABEL];
  return (
    <tr className="group transition-colors hover:bg-subtle">
      <td className="px-2 py-3 text-center"><label className="grid min-h-11 min-w-11 place-items-center"><input className="order-select size-5 accent-[var(--color-forest)]" type="checkbox" value={order.id} data-invoice={INVOICE_STATUSES.has(order.status) ? "1" : "0"} data-status={order.status} aria-label={`Select ${order.orderNo}`} /></label></td>
      <td className="px-3 py-3"><Link href={`/admin/orders/view?id=${order.id}`} className="font-bold text-forest-fg underline decoration-forest/25 underline-offset-4 group-hover:decoration-forest">{order.orderNo}</Link>{order.attention && <span title={order.attention} className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">⚠ Attention</span>}</td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-muted">{dateLabel(order.createdAt)}</td>
      <td className="px-3 py-3"><span className="block truncate font-semibold text-ink">{order.address.name}</span><span className="mt-0.5 block truncate text-xs text-ink-muted">{order.address.phone}</span><span className="block truncate text-xs text-ink-muted">{order.address.city} · {order.address.pincode}</span></td>
      <td className="px-3 py-3"><span className="block line-clamp-2 text-[13px] leading-relaxed text-ink">{itemsLabel(order.items)}</span><span className="mt-0.5 block text-[11px] text-ink-muted">{order.items.reduce((sum, item) => sum + item.quantity, 0)} units</span></td>
      <td className="px-3 py-3"><span className="block text-xs font-semibold text-ink">{paymentLabel(order.paymentMethod)}</span>{order.awb && <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-ink-muted">{order.shipProvider && <ProviderTag provider={order.shipProvider} className="px-1.5 py-0 text-[10px]" />}AWB {order.awb}</span>}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-forest-text">{formatMoney(order.total)}</td>
      <td className="px-3 py-3 text-right"><StatusBadge tone={label?.tone ?? "gray"}>{label?.text ?? order.status}</StatusBadge></td>
    </tr>
  );
}

function Pagination({ page, pages, total, perPage, href }: { page: number; pages: number; total: number; perPage: number; href: (changes: { f?: OrderFilter; q?: string; page?: number }) => string }) {
  return pages > 1 ? (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm" aria-label="Pagination">
      <span className="text-xs text-ink-muted">Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total} orders · Page {page} of {pages}</span>
      <div className="flex gap-2">{page > 1 && <Link href={href({ page: page - 1 })} className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 font-semibold text-forest-fg hover:bg-khaki-soft">← Newer</Link>}{page < pages && <Link href={href({ page: page + 1 })} className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 font-semibold text-forest-fg hover:bg-khaki-soft">Older →</Link>}</div>
    </nav>
  ) : null;
}

function DataError() {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-surface p-5"><p className="font-semibold text-red-800">Orders could not be loaded.</p><p className="mt-1 text-sm text-ink-muted">Check the database connection and refresh this page.</p></div>;
}

function itemsLabel(items: { quantity: number; productTitle: string; variantTitle: string }[]) {
  return items.map((item) => `${item.quantity} × ${item.productTitle.replace(/^(Wood|Cold)-Pressed /, "")} · ${item.variantTitle}`).join("  /  ");
}

const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value.replace(" ", "T") + "+05:30"));
const paymentLabel = (method: string) => method === "cod" ? "Cash on delivery" : method === "offline" ? "Offline paid" : "Paid online";
export const instant = false;
