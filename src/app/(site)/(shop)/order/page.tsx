import { cutoutUrl } from "@/lib/image-loader";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Check, RotateCcw } from "lucide-react";
import { AlertCircle, Banknote, Clock, CreditCard, MapPin, MessageCircle, PackageCheck, Phone, Truck, XCircle } from "@/components/icons/duo";
import { OrderCelebrate } from "@/components/checkout/OrderCelebrate";
import { PurchaseEvent } from "@/components/marketing/PurchaseEvent";
import { site, whatsappLink } from "@/data/site";
import { getProducts } from "@/lib/commerce";
import { getOrderByToken, type Order } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

export default function OrderPage({ searchParams }: PageProps<"/order">) {
  return (
    <div className="co-theme mx-auto max-w-[1000px] px-4 pt-6 pb-10 text-ink md:px-8 md:pt-12 md:pb-24">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white/60" />}>
        <OrderContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Tone = "success" | "pending" | "failed" | "neutral";

const HEADLINE: Record<Order["status"], { title: string; note: string; tone: Tone }> = {
  paid: { title: "Thank you! Your order is confirmed.", note: "Payment received. We'll pack it fresh and share tracking on WhatsApp.", tone: "success" },
  cod_pending: { title: "Thank you! Your order is placed.", note: "Pay in cash when it arrives. We'll call or WhatsApp to confirm before dispatch.", tone: "success" },
  pending_payment: { title: "Waiting for payment confirmation", note: "If money was deducted, it will reflect here shortly. Please don't pay twice.", tone: "pending" },
  payment_failed: { title: "Payment didn't go through", note: "No order was charged. You can try again below.", tone: "failed" },
  confirmed: { title: "Your order is confirmed", note: "We're getting it ready.", tone: "success" },
  packed: { title: "Packed and ready to ship", note: "It will be handed to the courier soon.", tone: "success" },
  rto: { title: "Your order is returning to us", note: "The courier couldn't deliver it. Message us to reship.", tone: "neutral" },
  refunded: { title: "Refunded", note: "Your refund has been processed.", tone: "neutral" },
  partially_refunded: { title: "Partly refunded", note: "Part of your payment has been refunded. Message us if you have questions.", tone: "neutral" },
  shipped: { title: "Your order is on the way", note: "It has been handed to the courier.", tone: "success" },
  delivered: { title: "Delivered", note: "We hope you enjoy it.", tone: "success" },
  cancelled: { title: "This order was cancelled", note: "Message us if this looks wrong.", tone: "failed" },
};

const STEPS = [
  { label: "Placed", icon: Check },
  { label: "Packed", icon: PackageCheck },
  { label: "Shipped", icon: Truck },
  { label: "Delivered", icon: MapPin },
];
const STEP_OF: Partial<Record<Order["status"], number>> = { paid: 0, cod_pending: 0, confirmed: 0, packed: 1, shipped: 2, delivered: 3 };

const TONE = {
  success: { icon: Check, ring: "bg-forest text-white", halo: "bg-forest/10" },
  pending: { icon: Clock, ring: "bg-mustard text-white", halo: "bg-mustard/15" },
  failed: { icon: XCircle, ring: "bg-alert text-white", halo: "bg-alert-soft" },
  neutral: { icon: RotateCcw, ring: "bg-ink-muted text-white", halo: "bg-khaki-soft" },
};

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

async function OrderContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = (await searchParams).t;
  const token = typeof t === "string" ? t : "";
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const products = await getProducts();
  const imageOf = (handle: string) => products.find((p) => p.handle === handle)?.images[0];
  const h = HEADLINE[order.status];
  const tone = TONE[h.tone];
  const ToneIcon = tone.icon;
  const a = order.address;
  const step = STEP_OF[order.status];
  const celebrate = order.status === "paid" || order.status === "cod_pending" || order.status === "confirmed";
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const PayIcon = order.paymentMethod === "cod" ? Banknote : CreditCard;

  return (
    <>
      {celebrate && (
        <>
          <PurchaseEvent
            orderNo={order.orderNo}
            total={order.total}
            items={order.items.map((item) => ({ productHandle: item.productHandle, quantity: item.quantity, unitPrice: item.unitPrice }))}
          />
          <OrderCelebrate orderNo={order.orderNo} />
        </>
      )}

      {/* Hero */}
      <section className="flex flex-col items-center text-center">
        <span className={cn("grid size-16 place-items-center rounded-full md:size-20", tone.halo)}>
          <span className={cn("grid size-11 place-items-center md:size-14 rounded-full shadow-[0_10px_24px_-12px_rgba(7,47,27,0.6)]", tone.ring)}>
            <ToneIcon className="size-6 md:size-7" strokeWidth={2.5} />
          </span>
        </span>
        <p className="mt-4 inline-flex md:mt-5 items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-muted">
          Order <span className="font-mono text-forest-text">{order.orderNo}</span>
        </p>
        <h1 className="mt-3 max-w-xl text-balance text-[26px] leading-tight md:text-[40px]">{h.title}</h1>
        <p className="mt-2 max-w-lg text-sm text-pretty text-ink-muted md:text-base">{h.note}</p>

        {/* Phones: two equal full-width buttons; larger screens: centred pills. */}
        <div className="mt-6 grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap sm:justify-center sm:gap-3">
          {order.status === "payment_failed" ? (
            <>
              {/* Plain <a>: the pay page must load fully so its PayU auto-post isn't cancelled by the router. */}
              <a href={`/checkout/pay?t=${order.token}`} className="btn-shine inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-4 text-sm font-bold text-white hover:bg-forest-mid sm:px-7">
                <RotateCcw className="size-4" /> Try payment again
              </a>
              <a
                href={whatsappLink(`Hi, my payment for order ${order.orderNo} failed.`)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-forest-text hover:border-forest/40 sm:px-6"
              >
                <MessageCircle className="size-4" /> Order on WhatsApp
              </a>
            </>
          ) : (
            <>
              <Link href={`/track-order?t=${order.token}`} className="btn-shine inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-4 text-sm font-bold text-white hover:bg-forest-mid sm:px-7">
                <Truck className="size-4" /> Track order
              </Link>
              <Link href="/shop" className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-forest-text hover:border-forest/40 sm:px-6">
                Continue shopping
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Progress */}
      {step !== undefined && (
        <section className="mt-8 rounded-3xl border border-line bg-white px-3 py-4 md:mt-10 md:p-7">
          <ol className="grid grid-cols-4">
            {STEPS.map((s, i) => {
              const done = i <= step;
              const I = s.icon;
              return (
                <li key={s.label} className="relative flex flex-col items-center gap-2 text-center">
                  {i > 0 && <span className={cn("absolute top-[18px] right-1/2 h-0.5 md:top-5 w-full -translate-y-1/2", i <= step ? "bg-forest" : "bg-line")} />}
                  <span className={cn("relative z-10 grid size-9 place-items-center rounded-full border-2 md:size-10", done ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted", i === step && "ring-4 ring-forest/15")}>
                    <I className="size-4" />
                  </span>
                  <span className={cn("text-[11px] font-semibold md:text-sm", done ? "text-forest-text" : "text-ink-muted")}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          {order.awb && (
            <p className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-khaki-soft px-4 py-3 text-sm">
              <Truck className="size-4 text-forest" /> Tracking <strong className="font-mono">{order.awb}</strong>
              {order.courierName ? <span className="text-ink-muted">· {order.courierName}</span> : null}
            </p>
          )}
        </section>
      )}

      {order.status === "pending_payment" && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl md:mt-8 border border-warm-line bg-warm px-4 py-3 text-sm text-ink">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-mustard" /> Refresh this page in a minute. If it still says waiting, WhatsApp us with order {order.orderNo}.
        </p>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:mt-6 md:grid-cols-[1.4fr_1fr] md:gap-5">
        {/* Items */}
        <section className="rounded-3xl border border-line bg-white">
          <h2 className="flex items-baseline justify-between border-b border-line px-4 py-3.5 text-base md:px-5 md:py-4 md:text-lg">
            Items <span className="text-xs font-normal text-ink-muted">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </h2>
          <ul className="divide-y divide-line px-4 md:px-5">
            {order.items.map((i) => {
              const img = imageOf(i.productHandle);
              return (
                <li key={i.variantKey} className="flex items-center gap-3 py-3">
                  <span className="relative grid size-14 shrink-0 place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_60%,#f3e6c8,#f6efe2_70%)]">
                    {img && <Image src={cutoutUrl(img.url)} alt="" width={56} height={56} className="size-12 object-contain" />}
                    <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-forest text-[10px] font-bold text-white">{i.quantity}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/products/${i.productHandle}`} className="block truncate text-sm font-semibold text-ink hover:text-forest">
                      {shortTitle(i.productTitle)}
                    </Link>
                    <span className="block text-xs text-ink-muted">{i.variantTitle}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(i.lineTotal)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="space-y-2 border-t border-line px-4 py-4 text-sm md:px-5">
            <Row label="Subtotal" value={formatMoney(order.subtotal)} />
            {order.discount > 0 && <Row label={order.couponCode ? `Coupon (${order.couponCode})` : "Discount"} value={`−${formatMoney(order.discount)}`} accent />}
            <Row label="Shipping" value={order.shipping ? formatMoney(order.shipping) : "Free"} accent={!order.shipping} />
            {order.codFee > 0 && <Row label="COD charge" value={formatMoney(order.codFee)} />}
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="text-xl font-extrabold text-forest tabular-nums">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        {/* Delivery + payment */}
        <div className="space-y-5">
          <section className="divide-y divide-line rounded-3xl border border-line bg-white">
            <div className="p-4 md:p-5">
              <h2 className="flex items-center gap-2 text-base md:text-lg">
                <MapPin className="size-4 text-forest/60" /> Delivering to
              </h2>
              <address className="mt-2 text-sm leading-relaxed break-words text-ink not-italic">
                <span className="font-semibold">{a.name}</span>
                <br />
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}, {a.state} {a.pincode}
                <br />
                <span className="text-ink-muted">{a.phone}</span>
              </address>
            </div>
            <div className="flex items-center justify-between gap-3 p-4 md:p-5">
              <h2 className="flex items-center gap-2 text-base md:text-lg">
                <PayIcon className="size-4 text-forest/60" /> Payment
              </h2>
              <p className="text-right text-sm text-ink">{order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod === "offline" ? "Paid offline" : "Online (PayU)"}</p>
            </div>
          </section>
          <section className="rounded-3xl bg-forest p-4 text-white md:p-5">
            <p className="font-semibold">Need help with this order?</p>
            <p className="mt-1 text-sm text-white/70">{site.supportHours}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <a
                href={whatsappLink(`Hi, I have a question about order ${order.orderNo}.`)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#e8c879] px-4 text-sm font-bold text-forest-deep hover:bg-white"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/30 px-4 text-sm font-semibold hover:bg-white/10">
                <Phone className="size-4" /> Call
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("tabular-nums", accent && "font-semibold text-forest")}>{value}</dd>
    </div>
  );
}
