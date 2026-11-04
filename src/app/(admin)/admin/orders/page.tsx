import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, StatusBadge, Table } from "@/components/admin/ui";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { listOrders, type OrderFilter } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Orders" };

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "to_ship", label: "To ship" },
  { id: "shipped", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "awaiting_payment", label: "Unpaid" },
  { id: "cancelled", label: "Cancelled / RTO" },
  { id: "all", label: "All" },
];

export default function OrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  return (
    <>
      <PageHeader
        title="Orders"
        intro="Open an order to book, cancel or track its NimbusPost shipment."
      />
      <Suspense fallback={<p className="text-ink-muted">Loading orders…</p>}>
        <OrdersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrdersTable({
  searchParams,
}: {
  searchParams: PageProps<"/admin/orders">["searchParams"];
}) {
  const sp = await searchParams;
  const str = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : "";
  const filter = (
    FILTERS.some((f) => f.id === str("f")) ? str("f") : "to_ship"
  ) as OrderFilter;
  const page = Math.max(Number(str("page")) || 1, 1);
  const q = str("q").slice(0, 60);

  const res = await listOrders({ filter, page, q }).catch(
    (e) => (console.error(e), null),
  );
  if (!res)
    return (
      <p className="text-sale">
        Could not connect to the database. Check DATABASE_* env vars.
      </p>
    );
  const pages = Math.max(Math.ceil(res.total / res.perPage), 1);
  const href = (p: Record<string, string | number>) => {
    const u = new URLSearchParams({
      f: filter,
      ...(q ? { q } : {}),
      ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
    });
    return `/admin/orders?${u}`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/admin/orders?f=${f.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold",
              f.id === filter
                ? "border-forest bg-forest text-white"
                : "border-line bg-white hover:border-forest/50",
            )}
          >
            {f.label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/orders">
          <input type="hidden" name="f" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Order no., phone or name"
            className="min-h-10 w-56 rounded-full border border-line px-4 text-sm"
          />
          <button className="min-h-10 rounded-full bg-forest px-4 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </div>

      {!res.orders.length ? (
        <p className="text-ink-muted">No orders here.</p>
      ) : (
        <Table
          head={[
            "Order",
            "Date",
            "Customer",
            "Items",
            "Payment",
            "Total",
            "Status",
          ]}
        >
          {res.orders.map((o) => (
            <tr key={o.id}>
              <td className="font-semibold">
                <Link
                  href={`/admin/orders/view?id=${o.id}`}
                  className="text-forest underline"
                >
                  {o.orderNo}
                </Link>
              </td>
              <td className="whitespace-nowrap">{o.createdAt.slice(0, 16)}</td>
              <td>
                {o.address.name}
                <span className="block text-sm text-ink-muted">
                  {o.address.phone} · {o.address.city}, {o.address.pincode}
                </span>
              </td>
              <td>
                {o.items.map((i) => (
                  <span key={i.variantKey} className="block text-sm">
                    {i.quantity} × {i.productTitle} ({i.variantTitle})
                  </span>
                ))}
              </td>
              <td>
                {o.paymentMethod === "cod"
                  ? "COD"
                  : o.paymentMethod === "offline"
                    ? "Offline paid"
                    : "PayU"}
                {o.awb && (
                  <span className="block text-sm text-ink-muted">
                    AWB {o.awb}
                  </span>
                )}
              </td>
              <td>{formatMoney(o.total)}</td>
              <td>
                <StatusBadge tone={ORDER_LABEL[o.status].tone}>
                  {ORDER_LABEL[o.status].text}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {pages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between text-sm"
          aria-label="Pagination"
        >
          <span className="text-ink-muted">
            Page {res.page} of {pages} · {res.total} orders
          </span>
          <div className="flex gap-2">
            {res.page > 1 && (
              <Link
                href={href({ page: res.page - 1 })}
                className="min-h-10 rounded-full border border-line px-4 leading-10"
              >
                ← Newer
              </Link>
            )}
            {res.page < pages && (
              <Link
                href={href({ page: res.page + 1 })}
                className="min-h-10 rounded-full border border-line px-4 leading-10"
              >
                Older →
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
