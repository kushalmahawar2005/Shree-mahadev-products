import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, PageHeader, StatusBadge, Table } from "@/components/admin/ui";
import { CustomerDetailsForm } from "@/components/admin/CustomerDetailsForm";
import { CustomerPhone } from "@/components/admin/CustomerPhone";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { getCustomerById } from "@/lib/server/customers";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Customer" };

export default function CustomerViewPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading customer…</p>}>
      <CustomerDetail searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomerDetail({
  searchParams,
}: {
  searchParams: PageProps<"/admin/customers">["searchParams"];
}) {
  await connection();
  const id = Number((await searchParams).id);
  const customer =
    Number.isInteger(id) && id > 0
      ? await getCustomerById(id).catch(
          (error) => (console.error("Could not load customer", error), null),
        )
      : null;
  if (!customer)
    return (
      <>
        <PageHeader
          title="Customer not found"
          action={
            <Link href="/admin/customers" className="text-forest underline">
              ← All customers
            </Link>
          }
        />
        <p className="text-ink-muted">
          This customer may have been removed, or the database is unavailable.
        </p>
      </>
    );

  return (
    <>
      <PageHeader
        title={customer.name}
        intro={`Customer since ${customer.createdAt.slice(0, 10)}`}
        action={
          <Link href="/admin/customers" className="text-forest underline">
            ← All customers
          </Link>
        }
      />
      <div className="mb-4">
        <CustomerPhone phone={customer.phone} />
      </div>
      {customer.email && (
        <p className="mb-5 text-ink-muted">
          <a className="underline" href={`mailto:${customer.email}`}>
            {customer.email}
          </a>
        </p>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-muted">Placed orders</p>
          <p className="mt-1 text-2xl font-bold text-forest-text">
            {customer.orderCount}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Lifetime value</p>
          <p className="mt-1 text-2xl font-bold text-forest-text">
            {formatMoney(customer.ltv)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">RTO history</p>
          <p className="mt-1">
            {customer.rtoCount ? (
              <StatusBadge tone="red">
                Risky · {customer.rtoCount} RTO
                {customer.rtoCount === 1 ? "" : "s"}
              </StatusBadge>
            ) : (
              <StatusBadge tone="green">No RTOs</StatusBadge>
            )}
          </p>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <div className="space-y-4">
          <Card title="Orders">
            {!customer.orders.length ? (
              <p className="text-sm text-ink-muted">No orders recorded.</p>
            ) : (
              <Table head={["Order", "Date", "Payment", "Total", "Status"]}>
                {customer.orders.map((order) => {
                  const label =
                    ORDER_LABEL[order.status as keyof typeof ORDER_LABEL];
                  return (
                    <tr key={order.id}>
                      <td>
                        <Link
                          className="font-semibold text-forest underline"
                          href={`/admin/orders/view?id=${order.id}`}
                        >
                          {order.orderNo}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {order.createdAt.slice(0, 10)}
                      </td>
                      <td>{order.paymentMethod === "cod" ? "COD" : "PayU"}</td>
                      <td className="whitespace-nowrap">
                        {formatMoney(order.total)}
                      </td>
                      <td>
                        {label ? (
                          <StatusBadge tone={label.tone}>
                            {label.text}
                          </StatusBadge>
                        ) : (
                          <StatusBadge>{order.status}</StatusBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>
          <Card title="Notes and tags">
            <CustomerDetailsForm
              customerId={customer.id}
              initialNotes={customer.notes}
              initialTags={customer.tags}
            />
          </Card>
        </div>
        <Card title="Addresses">
          {!customer.addresses.length ? (
            <p className="text-sm text-ink-muted">No saved addresses.</p>
          ) : (
            <ul className="divide-y divide-line">
              {customer.addresses.map((address, i) => (
                <li
                  key={`${address.pincode}-${i}`}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <p className="font-semibold">
                    {address.name} · {address.phone}
                  </p>
                  <address className="mt-1 text-sm leading-relaxed text-ink-muted not-italic">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                    <br />
                    {address.city}, {address.state} {address.pincode}
                  </address>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
