import type { Metadata } from "next";
import Link from "next/link";
import { CouponUnavailableError } from "@/lib/server/coupons";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AutoSubmit } from "@/components/checkout/AutoSubmit";
import { Loader2 } from "lucide-react";
import { Lock, MessageCircle, ShieldCheck } from "@/components/icons/duo";
import { buildPayuForm, PAYU_PAYMENT_URL } from "@/lib/server/payu";
import { cashfreeMode, createCashfreeOrder } from "@/lib/server/cashfree";
import { activeGateway } from "@/lib/server/payment-gateway";
import { CashfreeCheckout } from "@/components/checkout/CashfreeCheckout";
import { OutOfStockError } from "@/lib/server/inventory";
import { getOrderByToken, startPaymentAttempt } from "@/lib/server/orders";
import { site, whatsappLink } from "@/data/site";

export const metadata: Metadata = { title: "Secure payment", robots: { index: false } };

export default function PayPage({ searchParams }: PageProps<"/checkout/pay">) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 md:py-24">
      <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-[0_24px_48px_-32px_rgba(7,47,27,0.45)]">
        <Suspense fallback={<Spinner label="Preparing secure payment…" />}>
          <PayContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function PayContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Request-time only: this page creates a payment attempt (and a Cashfree order). It must never be
  // prerendered, or every prerender pass leaves a stray attempt behind.
  await connection();
  const t = (await searchParams).t;
  const token = typeof t === "string" ? t : "";
  const order = await getOrderByToken(token);
  if (!order) notFound();
  if (order.status !== "pending_payment" && order.status !== "payment_failed") redirect(`/order?t=${token}`);

  const gateway = await activeGateway();
  if (!gateway) {
    return (
      <div>
        <h1 className="text-2xl">Online payment is not set up yet</h1>
        <p className="mt-2 text-sm text-ink-muted">Order {order.orderNo} is saved. Please complete it on WhatsApp.</p>
        <WhatsAppButton href={whatsappLink(`Hi, I want to pay for order ${order.orderNo}.`)} label="Order on WhatsApp" />
      </div>
    );
  }

  let txnid: string;
  try {
    txnid = await startPaymentAttempt(order, gateway);
  } catch (e) {
    if (e instanceof CouponUnavailableError)
      return (
        <div>
          <h1 className="text-2xl">This order&apos;s coupon has run out</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {e.message} The order price included that discount, so please check out again from your cart (you can try another code).
          </p>
          <Link href="/cart" className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-6 text-sm font-semibold text-white hover:bg-forest-mid">
            Back to cart
          </Link>
        </div>
      );
    if (!(e instanceof OutOfStockError)) throw e;
    return (
      <div>
        <h1 className="text-2xl">Sorry, this went out of stock</h1>
        <p className="mt-2 text-sm text-ink-muted">{e.message}</p>
        <WhatsAppButton href={whatsappLink(`Hi, order ${order.orderNo} went out of stock while paying.`)} label="Message us on WhatsApp" />
      </div>
    );
  }
  // Production always uses the canonical domain. In dev, PayU must return to this machine
  // (localhost), otherwise it lands on the live site, which has no callback route.
  const host = (await headers()).get("host");
  const base =
    (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL) ||
    (host ? `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}` : "http://localhost:3000");
  if (gateway === "cashfree") {
    // Popup checkout on this page. return_url is only used when the popup can't open (in-app browsers).
    // notify_url must be https, so local dev relies on the popup result + reconcile instead.
    let sessionId: string;
    try {
      ({ paymentSessionId: sessionId } = await createCashfreeOrder({
        orderId: txnid,
        amount: order.total,
        customerId: `c${order.address.phone}`,
        phone: order.address.phone,
        name: order.address.name,
        email: order.address.email || undefined,
        returnUrl: `${base}/api/cashfree/return?t=${order.token}`,
        notifyUrl: base.startsWith("https://") ? `${base}/api/cashfree/webhook` : undefined,
        note: `Order ${order.orderNo}`,
      }));
    } catch (e) {
      console.error("Cashfree create order failed", e);
      return (
        <div>
          <h1 className="text-2xl">Payment couldn&apos;t start</h1>
          <p className="mt-2 text-sm text-ink-muted">Order {order.orderNo} is saved. Please try again in a minute, or finish it on WhatsApp.</p>
          <div className="mt-6 grid gap-2.5">
            {/* Plain <a>: a full load starts a fresh payment attempt. */}
            <a href={`/checkout/pay?t=${order.token}`} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-forest-mid">
              <Lock className="size-4" /> Try payment again
            </a>
            <a
              href={whatsappLink(`Hi, I want to pay for order ${order.orderNo}.`)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-6 text-sm font-semibold text-forest hover:border-forest/40"
            >
              <MessageCircle className="size-4" /> Message us on WhatsApp
            </a>
          </div>
        </div>
      );
    }
    return (
      <div>
        <CashfreeCheckout sessionId={sessionId} mode={cashfreeMode()} orderToken={order.token} />
        <p className="mt-4 text-sm text-ink-muted">
          Order <span className="font-mono text-forest-text">{order.orderNo}</span>
        </p>
        <p className="mt-2 text-3xl font-extrabold text-forest tabular-nums">₹{order.total.toLocaleString("en-IN")}</p>
      </div>
    );
  }

  // Token on the URL lets the callback recover if the browser drops the POST body.
  const callback = `${base}/api/payu/callback?t=${order.token}`;
  const fields = buildPayuForm({
    txnid,
    amount: order.total.toFixed(2),
    productinfo: `Order ${order.orderNo}`,
    firstname: order.address.name.split(" ")[0].replace(/[^\p{L}\p{N} .]/gu, "").slice(0, 60) || "Customer",
    email: order.address.email || site.email, // PayU requires an email; ours is optional at checkout
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
      <Spinner label="Taking you to PayU…" />
      <p className="mt-2 text-sm text-ink-muted">
        Order <span className="font-mono text-forest-text">{order.orderNo}</span>
      </p>
      <p className="mt-4 text-3xl font-extrabold text-forest tabular-nums">₹{order.total.toLocaleString("en-IN")}</p>
      <button type="submit" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest px-8 text-sm font-bold text-white hover:bg-forest-mid">
        <Lock className="size-4" /> Continue to payment
      </button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
        <ShieldCheck className="size-3.5 text-forest" /> Secured by PayU · Please don&apos;t press back
      </p>
      <AutoSubmit formId="payu-form" />
    </form>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="relative grid size-16 place-items-center rounded-full bg-khaki-soft">
        <Loader2 className="absolute size-16 animate-spin text-forest/30" strokeWidth={1} />
        <Lock className="size-6 text-forest" />
      </span>
      <h1 className="mt-5 text-2xl">{label}</h1>
    </div>
  );
}

function WhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-forest-mid">
      <MessageCircle className="size-4" /> {label}
    </a>
  );
}
