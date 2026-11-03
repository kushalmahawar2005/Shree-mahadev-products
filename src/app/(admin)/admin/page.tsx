import Link from "next/link";
import { Card, StatCard, StatusBadge, Table, PageHeader, statusTone } from "@/components/admin/ui";
import { mockStock, orders, revenueLast7 } from "@/data/admin";
import { getProducts } from "@/lib/commerce";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const products = await getProducts();
  const low = products.flatMap((p) =>
    p.variants.filter((v) => v.availableForSale && mockStock(v.id) < 5).map((v) => ({ p, v, n: mockStock(v.id) })),
  );
  const revenue = orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + o.total, 0);
  const max = Math.max(...revenueLast7.map((r) => r.v));
  const pending = orders.filter((o) => o.status === "Paid" || o.status === "COD").length;

  return (
    <>
      <PageHeader title="Dashboard" intro="Sample numbers for now. Real data comes from Shopify." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Revenue (sample)" value={formatMoney(revenue)} note="Last 7 days" />
        <StatCard label="Orders" value={String(orders.length)} note={`${pending} to ship`} />
        <StatCard label="Avg. order" value={formatMoney(Math.round(revenue / orders.length))} />
        <StatCard label="Low stock" value={String(low.length)} note="Variants under 5" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <Card title="Sales, last 7 days">
          <div className="flex h-44 items-end gap-3">
            {revenueLast7.map((r) => (
              <div key={r.d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="w-full rounded-t-lg bg-forest" style={{ height: `${(r.v / max) * 100}%` }} title={formatMoney(r.v)} />
                <span className="text-xs text-ink-muted">{r.d}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Low stock">
          {low.length === 0 ? (
            <p className="text-ink-muted">All good.</p>
          ) : (
            <ul className="space-y-2">
              {low.slice(0, 6).map(({ p, v, n }) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/products/edit?handle=${p.handle}`} className="hover:underline">
                    {p.title.replace(/^(Wood|Cold)-Pressed\s+/, "")} · {v.title}
                  </Link>
                  <StatusBadge tone={n === 0 ? "red" : "amber"}>{n === 0 ? "Out" : `${n} left`}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold text-forest-text">Recent orders</h2>
      <Table head={["Order", "Customer", "Total", "Status"]}>
        {orders.slice(0, 5).map((o) => (
          <tr key={o.id}>
            <td className="font-semibold">{o.id}</td>
            <td>{o.customer}</td>
            <td>{formatMoney(o.total)}</td>
            <td>
              <StatusBadge tone={statusTone(o.status) as "green"}>{o.status}</StatusBadge>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
