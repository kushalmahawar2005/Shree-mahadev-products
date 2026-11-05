import Link from "next/link";
import { Suspense } from "react";
import { ShipmentPanel } from "@/components/admin/ShipmentPanel";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { getProduct } from "@/lib/commerce";
import { nimbusConfigured } from "@/lib/server/nimbuspost";
import {
  getOrderById,
  getOrderEvents,
  listRefunds,
  refundableFor,
} from "@/lib/server/orders";
import { RefundPanel } from "@/components/admin/RefundPanel";
import { estimateWeightGrams } from "@/lib/server/shipping";
import { listShipments } from "@/lib/server/shipments";
import { listOrderEmails, mailConfigured } from "@/lib/server/mail";
import { OrderEmails } from "@/components/admin/OrderEmails";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Order" };

export default function OrderView({
  searchParams,
}: PageProps<"/admin/orders/view">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading order…</p>}>
      <OrderDetail searchParams={searchParams} />
    </Suspense>
  );
}

async function OrderDetail({
  searchParams,
}: {
  searchParams: PageProps<"/admin/orders/view">["searchParams"];
}) {
  const id = Number((await searchParams).id);
  const order =
    Number.isInteger(id) && id > 0
      ? await getOrderById(id).catch(() => null)
      : null;
  if (!order) return <p className="text-sale">Order not found.</p>;
  const [shipments, events, emails, refundable, refunds] = await Promise.all([
    listShipments(order.id),
    getOrderEvents(order.id),
    listOrderEmails(order.id),
    order.paymentMethod === "payu"
      ? refundableFor(order.id)
      : Promise.resolve(null),
    listRefunds(order.id),
  ]);

  // Prefill packed weight from the catalog (admin can edit before booking).
  let weight = 0;
  for (const i of order.items) {
    const v = (await getProduct(i.productHandle))?.variants.find(
      (x) => x.id === i.variantKey,
    );
    const packed = (v as { weightGrams?: number | null } | undefined)
      ?.weightGrams;
    weight += packed
      ? packed * i.quantity
      : v
        ? estimateWeightGrams(v.sizeValue, v.sizeUnit, i.quantity)
        : 500 * i.quantity;
  }
  const a = order.address;
  const label = ORDER_LABEL[order.status];

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNo}`}
        intro={`${order.createdAt.slice(0, 16)} · ${order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod === "offline" ? "Paid offline" : "Paid online (PayU)"}`}
        action={
          <div className="flex flex-wrap items-center gap-4">
            {!["pending_payment", "payment_failed", "cancelled", "rto", "refunded", "partially_refunded"].includes(order.status) && (
              <Link href={`/admin/orders/invoice?id=${order.id}`} className="inline-flex min-h-11 items-center rounded-full border border-forest px-4 font-semibold text-forest hover:bg-khaki-soft">Download invoice</Link>
            )}
            <Link href="/admin/orders" className="text-forest underline">← All orders</Link>
          </div>
        }
      />
      <div className="mb-4">
        <StatusBadge tone={label.tone}>{label.text}</StatusBadge>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card title="Shipping">
            <ShipmentPanel
              orderId={order.id}
              status={order.status}
              initialShipments={shipments}
              defaultWeight={weight}
              suggestedCourierId={order.courierId}
              configured={nimbusConfigured()}
            />
          </Card>
          <Card title="Items">
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li
                  key={i.variantKey}
                  className="flex justify-between gap-4 py-2"
                >
                  <span>
                    {i.quantity} × {i.productTitle}{" "}
                    <span className="text-ink-muted">({i.variantTitle})</span>
                    {i.sku && (
                      <span className="block text-xs text-ink-muted">
                        {i.sku}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(i.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatMoney(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-forest">
                  <dt>
                    {order.couponCode
                      ? `Coupon (${order.couponCode})`
                      : "Discount"}
                  </dt>
                  <dd>−{formatMoney(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Shipping charged</dt>
                <dd>{formatMoney(order.shipping)}</dd>
              </div>
              {order.codFee > 0 && (
                <div className="flex justify-between">
                  <dt>COD charge</dt>
                  <dd>{formatMoney(order.codFee)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd>{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Customer">
            <address className="not-italic leading-relaxed">
              <strong>{a.name}</strong>
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              <a href={`tel:+91${a.phone}`} className="text-forest underline">
                +91 {a.phone}
              </a>{" "}
              ·{" "}
              <a
                href={`https://wa.me/91${a.phone}`}
                target="_blank"
                rel="noreferrer"
                className="text-forest underline"
              >
                WhatsApp
              </a>
              <br />
              {a.email}
            </address>
            {order.courierName && (
              <p className="mt-3 text-sm text-ink-muted">
                Quoted at checkout: {order.courierName}
              </p>
            )}
          </Card>
          {refundable && (
            <Card title="Refund">
              <RefundPanel
                orderId={order.id}
                paid={refundable.paid}
                left={refundable.left}
                refunds={refunds}
              />
            </Card>
          )}
          <Card title="Messages">
            <OrderEmails
              orderId={order.id}
              initial={emails}
              hasEmail={!!order.address.email}
              configured={mailConfigured()}
            />
          </Card>
          <Card title="History">
            <ol className="space-y-2 text-sm">
              {events.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">
                    {ORDER_LABEL[e.to as keyof typeof ORDER_LABEL]?.text ??
                      e.to}
                  </span>
                  <span className="text-ink-muted">
                    {" "}
                    · {e.at.slice(0, 16)} · {e.actor}
                  </span>
                  {e.note && (
                    <span className="block text-ink-muted">{e.note}</span>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
export const instant = false;
