import { Suspense } from "react";
import { PageHeader, StatusBadge, Table } from "@/components/admin/ui";
import { listOrders, type Order } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Orders" };

const LABEL: Record<Order["status"], { text: string; tone: string }> = {
  paid: { text: "Paid", tone: "green" },
  cod_pending: { text: "COD", tone: "amber" },
  pending_payment: { text: "Awaiting payment", tone: "gray" },
  payment_failed: { text: "Payment failed", tone: "red" },
  confirmed: { text: "Confirmed", tone: "green" },
  packed: { text: "Packed", tone: "green" },
  shipped: { text: "Shipped", tone: "green" },
  rto: { text: "RTO", tone: "red" },
  refunded: { text: "Refunded", tone: "gray" },
  delivered: { text: "Delivered", tone: "green" },
  cancelled: { text: "Cancelled", tone: "red" },
};

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" intro="Paid and COD orders from the website. Book shipping in NimbusPost, then mark shipped." />
      <Suspense fallback={<p className="text-ink-muted">Loading orders…</p>}>
        <OrdersTable />
      </Suspense>
    </>
  );
}

async function OrdersTable() {
  let orders: Order[] = [];
  try {
    orders = await listOrders();
  } catch (e) {
    console.error(e);
    return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  }
  if (!orders.length) return <p className="text-ink-muted">No orders yet.</p>;
  return (
    <Table head={["Order", "Date", "Customer", "Items", "Payment", "Total", "Status"]}>
      {orders.map((o) => (
        <tr key={o.id}>
          <td className="font-semibold">{o.orderNo}</td>
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
            {o.paymentMethod === "cod" ? "COD" : "PayU"}
            {o.courierName && <span className="block text-sm text-ink-muted">{o.courierName}</span>}
          </td>
          <td>{formatMoney(o.total)}</td>
          <td>
            <StatusBadge tone={LABEL[o.status].tone as "green"}>{LABEL[o.status].text}</StatusBadge>
          </td>
        </tr>
      ))}
    </Table>
  );
}
