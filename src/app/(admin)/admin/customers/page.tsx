import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, PageHeader, StatusBadge, Table } from "@/components/admin/ui";
import {
  CUSTOMER_FILTERS,
  CUSTOMER_LTV_THRESHOLD,
  listCustomers,
  type CustomerFilter,
} from "@/lib/server/customers";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Customers" };

const FILTER_LABEL: Record<CustomerFilter, string> = {
  all: "All customers",
  repeat: "Repeat buyers",
  one_time: "One-time buyers",
  high_value: "High value",
  inactive_90d: "Inactive 90 days",
  cod_only: "COD only",
  rto: "RTO history",
};

export default function CustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  return (
    <>
      <PageHeader
        title="Customers"
        intro="Customer profiles and order history from your store."
      />
      <Suspense fallback={<p className="text-ink-muted">Loading customers…</p>}>
        <CustomersTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomersTable({
  searchParams,
}: {
  searchParams: PageProps<"/admin/customers">["searchParams"];
}) {
  await connection();
  const sp = await searchParams;
  const str = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";
  const filter = CUSTOMER_FILTERS.includes(str("f") as CustomerFilter)
    ? (str("f") as CustomerFilter)
    : "all";
  const q = str("q").trim().slice(0, 80);
  const page = Math.max(1, Math.floor(Number(str("page")) || 1));
  const result = await listCustomers({ q, filter, page }).catch(
    (error) => (console.error("Could not load customers", error), null),
  );
  if (!result)
    return (
      <p className="text-sale">
        Could not connect to the database. Check DATABASE_* env vars.
      </p>
    );

  const pages = Math.max(1, Math.ceil(result.total / result.perPage));
  const href = (nextPage?: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "all") params.set("f", filter);
    if (nextPage && nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return `/admin/customers${query ? `?${query}` : ""}`;
  };
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (filter !== "all") exportParams.set("f", filter);

  return (
    <>
      <Card className="mb-4">
        <form
          action="/admin/customers"
          className="flex flex-wrap items-end gap-3"
        >
          <label className="min-w-52 flex-1">
            <span className="mb-1 block text-sm font-semibold text-forest-text">
              Search
            </span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Name, phone or email"
              className="min-h-11 w-full rounded-full border border-line px-4"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-forest-text">
              Filter
            </span>
            <select
              name="f"
              defaultValue={filter}
              className="min-h-11 rounded-full border border-line bg-white px-4"
            >
              {CUSTOMER_FILTERS.map((id) => (
                <option key={id} value={id}>
                  {FILTER_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white">
            Apply
          </button>
          <a
            href={`/admin/customers/export${exportParams.size ? `?${exportParams}` : ""}`}
            className="inline-flex min-h-11 items-center rounded-full border border-forest px-5 font-semibold text-forest"
          >
            Export CSV
          </a>
          <p className="w-full text-sm text-ink-muted">
            High value means lifetime spend of{" "}
            {formatMoney(CUSTOMER_LTV_THRESHOLD)} or more.
          </p>
        </form>
      </Card>

      {!result.customers.length ? (
        <p className="text-ink-muted">No customers match these filters.</p>
      ) : (
        <Table
          head={[
            "Customer",
            "Location",
            "Orders",
            "Lifetime value",
            "Last order",
            "Flags",
          ]}
        >
          {result.customers.map((customer) => (
            <tr key={customer.id}>
              <td>
                <Link
                  href={`/admin/customers/view?id=${customer.id}`}
                  className="font-semibold text-forest underline"
                >
                  {customer.name}
                </Link>
                <span className="block text-sm text-ink-muted">
                  {customer.phone}
                  {customer.email ? ` · ${customer.email}` : ""}
                </span>
              </td>
              <td>
                {customer.city
                  ? `${customer.city}${customer.state ? `, ${customer.state}` : ""}`
                  : "—"}
              </td>
              <td>{customer.orders}</td>
              <td className="whitespace-nowrap">{formatMoney(customer.ltv)}</td>
              <td className="whitespace-nowrap">
                {customer.lastOrder ? customer.lastOrder.slice(0, 10) : "—"}
              </td>
              <td className="space-x-1 whitespace-nowrap">
                {customer.codOnly && (
                  <StatusBadge tone="amber">COD only</StatusBadge>
                )}
                {customer.rtoCount > 0 && (
                  <StatusBadge tone="red">Risky</StatusBadge>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {pages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between text-sm"
          aria-label="Customer pagination"
        >
          <span className="text-ink-muted">
            Page {result.page} of {pages} · {result.total} customers
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={href(result.page - 1)}
                className="min-h-11 rounded-full border border-line px-4 py-3"
              >
                ← Newer
              </Link>
            )}
            {result.page < pages && (
              <Link
                href={href(result.page + 1)}
                className={cn(
                  "min-h-11 rounded-full border border-line px-4 py-3",
                )}
              >
                Older →
              </Link>
            )}
          </div>
        </nav>
      )}
      {pages <= 1 && (
        <p className="mt-3 text-sm text-ink-muted">{result.total} customers</p>
      )}
    </>
  );
}
export const instant = false;
