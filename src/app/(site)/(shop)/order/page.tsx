import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Container } from "@/components/ui/primitives";
import { site, whatsappLink } from "@/data/site";
import { getOrderByToken, type Order } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

export default function OrderPage({ searchParams }: PageProps<"/order">) {
  return (
    <Container className="max-w-3xl py-12 md:py-16">
      <Suspense
        fallback={<p className="text-ink-muted">Loading your order…</p>}
      >
        <OrderContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

const HEADLINE: Record<Order["status"], { title: string; note: string }> = {
  paid: {
    title: "Thank you! Your order is confirmed.",
    note: "Payment received. We'll pack it fresh and share tracking on WhatsApp.",
  },
  cod_pending: {
    title: "Thank you! Your order is placed.",
    note: "Pay in cash when it arrives. We'll call or WhatsApp to confirm before dispatch.",
  },
  pending_payment: {
    title: "Waiting for payment confirmation",
    note: "If money was deducted, it will reflect here shortly. Please don't pay twice.",
  },
  payment_failed: {
    title: "Payment didn't go through",
    note: "No order was charged. You can try again below.",
  },
  confirmed: {
    title: "Your order is confirmed",
    note: "We're getting it ready.",
  },
  packed: {
    title: "Packed and ready to ship",
    note: "It will be handed to the courier soon.",
  },
  rto: {
    title: "Your order is returning to us",
    note: "The courier couldn't deliver it. Message us to reship.",
  },
  refunded: { title: "Refunded", note: "Your refund has been processed." },
  partially_refunded: {
    title: "Partly refunded",
    note: "Part of your payment has been refunded. Message us if you have questions.",
  },
  shipped: {
    title: "Your order is on the way",
    note: "It has been handed to the courier.",
  },
  delivered: { title: "Delivered", note: "We hope you enjoy it." },
  cancelled: {
    title: "This order was cancelled",
    note: "Message us if this looks wrong.",
  },
};

async function OrderContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = (await searchParams).t;
  const token = typeof t === "string" ? t : "";
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const h = HEADLINE[order.status];
  const a = order.address;

  return (
    <>
      <p className="text-sm font-semibold text-mustard">
        Order {order.orderNo}
      </p>
      <h1 className="mt-2 text-4xl md:text-5xl">{h.title}</h1>
      <p className="mt-3 text-lg text-ink-muted">{h.note}</p>

      {order.status === "payment_failed" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/checkout/pay?t=${order.token}`}
            className={buttonClass("primary", "lg")}
          >
            Try payment again
          </Link>
          <a
            href={whatsappLink(
              `Hi, my payment for order ${order.orderNo} failed.`,
            )}
            className={buttonClass("secondary", "lg")}
          >
            Order on WhatsApp
          </a>
        </div>
      )}
      {order.awb && (
        <p className="mt-4 rounded-2xl bg-khaki-soft p-4">
          Tracking: <strong>{order.awb}</strong>
          {order.courierName ? ` (${order.courierName})` : ""}
        </p>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl">Items</h2>
          <ul className="mt-3 divide-y divide-line">
            {order.items.map((i) => (
              <li
                key={i.variantKey}
                className="flex justify-between gap-4 py-3"
              >
                <span>
                  <span className="block font-semibold text-forest-text">
                    {i.productTitle}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {i.variantTitle} × {i.quantity}
                  </span>
                </span>
                <span className="font-semibold">
                  {formatMoney(i.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
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
              <dt className="text-ink-muted">Shipping</dt>
              <dd>{order.shipping ? formatMoney(order.shipping) : "Free"}</dd>
            </div>
            {order.codFee > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-muted">COD charge</dt>
                <dd>{formatMoney(order.codFee)}</dd>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-forest-text">
              <dt>Total</dt>
              <dd>{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h2 className="text-xl">Delivering to</h2>
          <address className="mt-3 not-italic leading-relaxed text-ink">
            {a.name}
            <br />
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ""}
            <br />
            {a.city}, {a.state} {a.pincode}
            <br />
            {a.phone}
          </address>
          <p className="mt-4 text-sm text-ink-muted">
            Payment:{" "}
            {order.paymentMethod === "cod"
              ? "Cash on delivery"
              : order.paymentMethod === "offline"
                ? "Paid offline"
                : "Online (PayU)"}
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm text-ink-muted">
        Questions? WhatsApp or call {site.phone}, {site.supportHours}.
      </p>
    </>
  );
}
