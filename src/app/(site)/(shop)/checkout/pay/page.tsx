import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AutoSubmit } from "@/components/checkout/AutoSubmit";
import { Container } from "@/components/ui/primitives";
import { buildPayuForm, PAYU_PAYMENT_URL, payuConfigured } from "@/lib/server/payu";
import { OutOfStockError } from "@/lib/server/inventory";
import { getOrderByToken, startPaymentAttempt } from "@/lib/server/orders";
import { whatsappLink } from "@/data/site";

export const metadata: Metadata = { title: "Redirecting to payment", robots: { index: false } };

export default function PayPage({ searchParams }: PageProps<"/checkout/pay">) {
  return (
    <Container className="max-w-xl py-16 text-center">
      <Suspense fallback={<p className="text-ink-muted">Preparing secure payment…</p>}>
        <PayContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function PayContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = (await searchParams).t;
  const token = typeof t === "string" ? t : "";
  const order = await getOrderByToken(token);
  if (!order) notFound();
  if (order.status !== "pending_payment" && order.status !== "payment_failed") redirect(`/order?t=${token}`);

  if (!payuConfigured()) {
    return (
      <div>
        <h1 className="text-3xl">Online payment is not set up yet</h1>
        <p className="mt-3 text-ink-muted">Order {order.orderNo} is saved. Please complete it on WhatsApp.</p>
        <a className="mt-6 inline-block font-semibold text-forest underline" href={whatsappLink(`Hi, I want to pay for order ${order.orderNo}.`)}>
          Order on WhatsApp
        </a>
      </div>
    );
  }

  let txnid: string;
  try {
    txnid = await startPaymentAttempt(order);
  } catch (e) {
    if (!(e instanceof OutOfStockError)) throw e;
    return (
      <div>
        <h1 className="text-3xl">Sorry, this went out of stock</h1>
        <p className="mt-3 text-ink-muted">{e.message}</p>
        <a className="mt-6 inline-block font-semibold text-forest underline" href={whatsappLink(`Hi, order ${order.orderNo} went out of stock while paying.`)}>
          Message us on WhatsApp
        </a>
      </div>
    );
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callback = `${base}/api/payu/callback`;
  const fields = buildPayuForm({
    txnid,
    amount: order.total.toFixed(2),
    productinfo: `Order ${order.orderNo}`,
    firstname: order.address.name.split(" ")[0].replace(/[^\p{L}\p{N} .]/gu, "").slice(0, 60) || "Customer",
    email: order.address.email,
    phone: order.address.phone,
    surl: callback,
    furl: callback,
    udf1: order.token,
  });

  return (
    <form id="payu-form" method="post" action={PAYU_PAYMENT_URL}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <h1 className="text-3xl">Taking you to PayU…</h1>
      <p className="mt-3 text-ink-muted">
        Order {order.orderNo} · ₹{order.total.toLocaleString("en-IN")}
      </p>
      <button type="submit" className="mt-6 min-h-12 rounded-full bg-forest px-8 font-semibold text-white hover:bg-forest-mid">
        Continue to payment
      </button>
      <AutoSubmit formId="payu-form" />
    </form>
  );
}
