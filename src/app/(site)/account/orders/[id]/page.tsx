import Image from "next/image";
import { RequestCallback } from "@/components/account/help/RequestCallback";
import { isPaidOnline } from "@/components/account/help/help-lib";
import { dedupeScans, scanLine } from "@/lib/tracking-text";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  AlertTriangle,
  ArrowLeft,
  CircleCheck,
  CreditCard,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  ReceiptIndianRupee,
  Star,
  Truck,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  BuyAgainAll,
  BuyAgainLine,
  CancelOrderButton,
  CopyId,
  DownloadLink,
  EventTimeline,
  MoreMenu,
  Reveal,
  ReturnRequest,
  TrackingUpdates,
} from "@/components/account/OrderDetailClient";
import { primaryBtn, secondaryBtn } from "@/lib/account/ui-classes";
import { OrderStatusBadge } from "@/components/account/shared";
import { accountConfig } from "@/config/account";
import { helpLink } from "@/data/site";
import { arrivingBy } from "@/lib/account/order-status";
import {
  PAY_MODES,
  TONE_CLASSES,
  buildTimeline,
  isCaptured,
  middleTruncate,
  returnClosesOn,
  statusUi,
  type StatusUi,
} from "@/lib/account/order-ui";
import { productInfo } from "@/lib/account/usuals";
import { getProducts } from "@/lib/commerce";
import { cutoutUrl } from "@/lib/image-loader";
import { getAccountOrder, getAccountShell, type AccountOrderDetail } from "@/lib/server/account";
import { invoiceInfoForOrder } from "@/lib/server/invoices";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatName, formatPhone } from "@/lib/utils/format";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Order details", robots: { index: false } };
// Per-session data: render per request (the layout opt-out does not cover sibling pages).
export const instant = false;

const card = "rounded-3xl border border-line bg-white p-5 shadow-co-card md:p-6";
const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");
const BEFORE_SHIPPING = new Set(["pending_payment", "cod_pending", "confirmed", "packed", "paid"]);
const RETURN_FLOW = ["requested", "approved", "received", "refunded"] as const;
const RETURN_LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  received: "Picked up",
  refunded: "Refunded",
};
const BANNER_ICON = {
  card: CreditCard,
  alert: AlertTriangle,
  box: Package,
  truck: Truck,
  check: CircleCheck,
  x: XCircle,
  undo: Undo2,
} as const;

/** Address lines without repeating city/state/PIN that shoppers often type into line 1. */
function addressLines(a: AccountOrderDetail["address"]) {
  const tail = [a.city, a.state, a.pincode].map((p) => p.trim().toLowerCase()).filter(Boolean);
  const parts = `${a.line1}, ${a.line2}`
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !tail.includes(p.toLowerCase()));
  const street = parts
    .map((p) => {
      // Drop a trailing " Bijainagar" if it is the city again.
      const re = new RegExp(`\\s+(${tail.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`, "i");
      return p.replace(re, "");
    })
    .filter((p, i, arr) => p && arr.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  return {
    street: formatName(street.join(", ")),
    place: `${formatName(a.city)}, ${formatName(a.state)} ${a.pincode}`.trim(),
  };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const shell = await getAccountShell();
  if (!shell) return null; // layout redirects
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [o, products] = await Promise.all([getAccountOrder(shell.customer.id, id), getProducts()]);
  if (!o) notFound();
  const info = productInfo(products);

  const shipping = o.status === "shipped" || o.status === "out_for_delivery";
  const eta = ["paid", "cod_pending", "confirmed", "packed", "shipped", "out_for_delivery"].includes(o.status)
    ? arrivingBy(o.eta)
    : null;
  const ui = statusUi(o, eta);
  const captured = isCaptured(o);
  const itemCount = o.items.reduce((s, i) => s + i.qty, 0);
  const help = helpLink(o.orderNo);

  // GST invoice: issued once the sale is final (online payment captured, or COD dispatched).
  const inv = await invoiceInfoForOrder(o.id);
  const invoiceHref = inv.applicable || inv.invoice ? `/api/account/orders/${o.id}/invoice` : null;
  const refundedTotal = o.refunds.filter((r) => r.status === "success").reduce((s, r) => s + r.amount, 0);

  // Paid online + not shipped: the cancel button sends a request to the team (refund needed).
  const paidOnline = isPaidOnline(o.status, o.method);
  const canCancel = BEFORE_SHIPPING.has(o.status) &&
    !(o.status === "pending_payment" && o.expiresInHours !== null && o.expiresInHours <= 0);
  const timeline = buildTimeline(o);
  const timelineTimes = Object.fromEntries(
    timeline.filter((t) => t.at).map((t) => [t.key, formatDateTime(t.at!)]),
  );
  // Courier scans as clear lines ("Left Jaipur hub", "Out for delivery in Bijainagar"); newest first,
  // repeated identical scans shown once. The place is part of the line.
  const tracking = dedupeScans(
    o.tracking.map((t) => ({ line: scanLine(t.status, t.message, t.location), at: t.at })),
  ).map((t) => ({ label: t.line, location: null, at: formatDateTime(t.at) }));

  const primary = <PrimaryAction kind={ui.primary} o={o} />;
  const addr = addressLines(o.address);

  return (
    <div className="pb-24 lg:pb-0">
      {/* Header */}
      <header className="mb-5">
        <Link
          href="/account/orders"
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> My orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="flex min-w-0 items-center text-2xl text-ink md:text-3xl">
                <span className="mr-1.5">Order</span>
                <span className="truncate font-mono">{o.orderNo}</span>
              </h1>
              <CopyId value={o.orderNo} label="order ID" />
              <OrderStatusBadge status={o.status} />
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Placed {formatDateTime(o.createdAt)} · {itemCount} item{itemCount === 1 ? "" : "s"} ·{" "}
              <span className="tabular-nums">{formatMoney(o.total)}</span>
            </p>
          </div>
          <div className="hidden items-center gap-2 lg:flex [&>*:first-child]:w-auto [&>*:first-child]:px-5">
            {primary}
            <MoreMenu invoiceHref={invoiceHref} helpHref={help} />
          </div>
        </div>
      </header>

      {/* Status banner */}
      <Reveal className="mb-5 lg:mb-6">
        <StatusBanner ui={ui} o={o} canCancel={canCancel} paidOnline={paidOnline} tracking={shipping} />
      </Reveal>

      {/* Body: two columns on desktop; on phones `contents` lets cards reorder (items → price → timeline …). */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-6">
        <div className="contents lg:col-span-7 lg:block lg:space-y-6">
          {/* Timeline */}
          <Reveal i={1} className="order-3">
            <section id="tracking" className={cn(card, "scroll-mt-28")} aria-labelledby="tl-h">
              <h2 id="tl-h" className="mb-4 text-lg font-bold text-ink">
                Order timeline
              </h2>
              <EventTimeline steps={timeline} times={timelineTimes} />
              {(o.courier || o.awb) && (
                <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-page/70 px-4 py-3 text-sm">
                  <Truck className="size-4 text-ink-muted" />
                  {o.courier && <span className="font-semibold text-ink">{o.courier}</span>}
                  {o.awb && (
                    <span className="inline-flex min-w-0 items-center text-ink-muted">
                      AWB&nbsp;<span className="truncate font-mono text-ink">{o.awb}</span>
                      <CopyId value={o.awb} label="AWB number" />
                    </span>
                  )}
                  {o.trackingUrl && (
                    <a
                      href={o.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-1 rounded-full font-semibold whitespace-nowrap text-forest hover:underline sm:ml-auto"
                    >
                      Track on courier <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              )}
              {tracking.length > 0 && <TrackingUpdates events={tracking} />}
            </section>
          </Reveal>

          {/* Items */}
          <Reveal i={2} className="order-1">
            <section className={card} aria-labelledby="items-h">
              <h2 id="items-h" className="text-lg font-bold text-ink">
                Items <span className="text-sm font-medium text-ink-muted">({itemCount})</span>
              </h2>
              <ul className="mt-2 divide-y divide-line">
                {o.items.map((i) => {
                  const img = info[i.handle]?.image;
                  return (
                    <li key={i.variantKey} className="flex gap-3 py-4 last:pb-2">
                      <Link
                        href={`/products/${i.handle}`}
                        className="grid size-16 shrink-0 place-items-center rounded-2xl bg-page ring-1 ring-line"
                        aria-label={shortTitle(i.title)}
                      >
                        {img && (
                          <Image src={cutoutUrl(img)} alt="" width={64} height={64} className="size-14 object-contain" />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/products/${i.handle}`} className="font-semibold text-ink hover:underline">
                              {shortTitle(i.title)}
                            </Link>
                            {info[i.handle]?.titleHi && (
                              <p className="font-hindi text-sm text-ink-muted" lang="hi">
                                {info[i.handle]!.titleHi}
                              </p>
                            )}
                            <p className="text-xs text-ink-muted tabular-nums">
                              {i.variant} · {formatMoney(i.price)} × {i.qty}
                            </p>
                          </div>
                          <div className="text-right tabular-nums">
                            <p className="font-bold text-ink">{formatMoney(i.price * i.qty)}</p>
                            {i.mrp > i.price && (
                              <p className="text-xs text-ink-muted line-through">{formatMoney(i.mrp * i.qty)}</p>
                            )}
                          </div>
                        </div>
                        <div className="-ml-3 mt-1 flex flex-wrap items-center">
                          <BuyAgainLine variantKey={i.variantKey} qty={i.qty} />
                          {o.status === "delivered" && !o.reviewed && (
                            <Link
                              href={`/review?t=${o.token}`}
                              className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-co-accent-ink hover:bg-co-accent-soft"
                            >
                              <Star className="size-3.5" /> Rate
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 border-t border-line pt-4">
                <BuyAgainAll
                  items={o.items}
                  label="Reorder all items"
                  className={cn(secondaryBtn, "lg:w-auto lg:px-5")}
                />
              </div>
            </section>
          </Reveal>
        </div>

        <aside className="contents lg:col-span-5 lg:block lg:space-y-6 lg:self-start lg:sticky lg:top-24">
          {/* Price */}
          <Reveal i={3} className="order-2">
            <PriceCard o={o} ui={ui} refunded={refundedTotal} />
          </Reveal>

          {/* Payment */}
          <Reveal i={4} className="order-4">
            <section className={card} aria-labelledby="pay-h">
              <h2 id="pay-h" className="flex items-center gap-2 text-base font-bold text-ink">
                <ReceiptIndianRupee className="size-4 text-ink-muted" /> Payment
              </h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <Row label="Method">{paymentMethod(o)}</Row>
                <Row label="Status">{paymentStatus(o, captured, refundedTotal)}</Row>
                {captured && (o.paidAt || o.payment?.at) && (
                  <Row label="Paid on">{formatDateTime(o.paidAt ?? o.payment!.at)}</Row>
                )}
                {o.method !== "cod" && o.payment?.txnid && (
                  <Row label="Transaction ID">
                    <span className="-mr-2 inline-flex max-w-full items-center justify-end font-mono text-xs">
                      <span className="truncate">{middleTruncate(o.payment.txnid)}</span>
                      <CopyId value={o.payment.txnid} label="transaction ID" className="size-8" />
                    </span>
                  </Row>
                )}
                {o.payment?.bankRef && captured && (
                  <Row label="Bank ref / UTR">
                    <span className="-mr-2 inline-flex max-w-full items-center justify-end font-mono text-xs">
                      <span className="truncate">{middleTruncate(o.payment.bankRef)}</span>
                      <CopyId value={o.payment.bankRef} label="bank reference" className="size-8" />
                    </span>
                  </Row>
                )}
              </dl>
              {(invoiceHref || o.status === "cancelled" || inv.creditNotes.length > 0) && (
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  {invoiceHref ? (
                    <DownloadLink href={invoiceHref} label="Download invoice" className={secondaryBtn} />
                  ) : (
                    <p className="text-xs text-ink-muted">
                      Invoice not applicable (order cancelled before payment).
                    </p>
                  )}
                  {inv.creditNotes.map((cn) => (
                    <DownloadLink
                      key={cn.id}
                      href={`/api/account/orders/${o.id}/credit-note?n=${cn.id}`}
                      label={`Credit note ${formatMoney(cn.amount)}`}
                      className={secondaryBtn}
                    />
                  ))}
                </div>
              )}
            </section>
          </Reveal>

          {/* Address */}
          <Reveal i={5} className="order-5">
            <section className={card} aria-labelledby="addr-h">
              <h2 id="addr-h" className="flex items-center gap-2 text-base font-bold text-ink">
                <MapPin className="size-4 text-ink-muted" /> Delivery address
              </h2>
              <address className="mt-3 text-sm leading-relaxed text-ink-muted not-italic">
                <span className="block font-semibold text-ink">{formatName(o.address.name)}</span>
                {addr.street && <span className="block">{addr.street}</span>}
                <span className="block">{addr.place}</span>
                <span className="mt-1 block tabular-nums">{formatPhone(o.address.phone)}</span>
              </address>
            </section>
          </Reveal>

          {/* Help */}
          <Reveal i={6} className="order-6">
            <section className="rounded-3xl border border-line bg-white p-4 shadow-co-card" aria-labelledby="help-h">
              <p id="help-h" className="text-sm font-semibold text-ink">
                Need help with this order?
              </p>
              <RequestCallback orderId={o.id} orderNo={o.orderNo} phone={formatPhone(shell.customer.phone)} className="mt-3" />
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Link href={help} className={cn(secondaryBtn, "whitespace-nowrap sm:col-span-2 lg:col-span-1 xl:col-span-2")}>
                  <MessageCircle className="size-4" /> Raise a request
                </Link>
              </div>
            </section>
          </Reveal>
        </aside>
      </div>

      {/* Phone: sticky primary action */}
      {ui.primary && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden [&>*:first-child]:flex-1">
          {primary}
          <MoreMenu invoiceHref={invoiceHref} helpHref={help} />
        </div>
      )}
    </div>
  );
}

function PrimaryAction({ kind, o }: { kind: StatusUi["primary"]; o: AccountOrderDetail }) {
  switch (kind) {
    case "pay":
    case "retry":
      // Plain <a>: the pay page must fully load so its PayU auto-post isn't cancelled by the router.
      return (
        <a href={`/checkout/pay?t=${o.token}`} className={cn(primaryBtn, "whitespace-nowrap")}>
          <CreditCard className="size-4" />
          {kind === "pay" ? `Complete payment ${formatMoney(o.total)}` : "Retry payment"}
        </a>
      );
    case "track":
      return (
        <a href="#tracking" className={cn(primaryBtn, "whitespace-nowrap")}>
          <Truck className="size-4" /> Track order
        </a>
      );
    case "track-disabled":
      return (
        <span
          aria-disabled="true"
          title="Tracking starts once the order ships"
          className={cn(primaryBtn, "cursor-not-allowed whitespace-nowrap opacity-50")}
        >
          <Truck className="size-4" /> Track order
        </span>
      );
    case "reorder":
      return (
        <BuyAgainAll
          items={o.items}
          label={`Reorder all ${formatMoney(o.items.reduce((s, i) => s + i.price * i.qty, 0))}`}
          className={cn(primaryBtn, "whitespace-nowrap")}
        />
      );
    default:
      return null;
  }
}

function StatusBanner({
  ui,
  o,
  canCancel,
  paidOnline,
  tracking,
}: {
  ui: StatusUi;
  o: AccountOrderDetail;
  canCancel: boolean;
  paidOnline: boolean;
  tracking: boolean;
}) {
  const tone = TONE_CLASSES[ui.tone];
  const Icon = BANNER_ICON[ui.icon];
  const captured = isCaptured(o);
  const isCancelled = o.status === "cancelled";
  const closes = o.status === "delivered" ? returnClosesOn(o) : null;
  const canReturn = o.returnDaysLeft !== null && o.returnDaysLeft >= 0 && !o.returnRequest;
  const ret = o.returnRequest;
  const retStep = ret ? RETURN_FLOW.indexOf(ret.status as (typeof RETURN_FLOW)[number]) : -1;

  return (
    <section className={cn("rounded-3xl border p-5 md:p-6", tone.banner)} aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-white ring-1", tone.icon)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{ui.title}</p>
          {ui.text && <p className={cn("mt-0.5 text-sm", tone.text)}>{ui.text}</p>}

          {tracking && (o.courier || o.awb) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-ink">
              {o.awb && (
                <span className="inline-flex items-center">
                  AWB&nbsp;<span className="font-mono">{o.awb}</span>
                  <CopyId value={o.awb} label="AWB number" />
                </span>
              )}
              {o.trackingUrl && (
                <a
                  href={o.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1 font-semibold text-forest hover:underline"
                >
                  Track on courier <ExternalLink className="size-3.5" />
                </a>
              )}
            </p>
          )}

          {isCancelled && (
            <p className="mt-2 text-sm text-ink">
              {captured || o.refunds.length
                ? null
                : o.method === "cod"
                  ? "Nothing to pay for this order."
                  : "No payment was taken for this order."}
            </p>
          )}

          {o.refunds.map((r, i) => (
            <p key={i} className="mt-2 flex items-start gap-2 text-sm text-ink">
              <Wallet className="mt-0.5 size-4 shrink-0 text-co-success" />
              <span>
                <span className="font-semibold">
                  Refund of {formatMoney(r.amount)}{" "}
                  {r.status === "success" ? "processed" : r.status === "failed" ? "failed" : "initiated"} to your{" "}
                  {o.payment?.mode ? (PAY_MODES[o.payment.mode] ?? o.payment.mode) : "original payment method"} on{" "}
                  {formatDateTime(r.at, { time: false })}
                </span>
                <span className="block text-xs text-ink-muted">
                  {r.status === "failed"
                    ? "Our team is on it and will WhatsApp you."
                    : `Usually 5–7 working days${r.ref ? ` · Ref ${r.ref}` : ""}`}
                </span>
              </span>
            </p>
          ))}

          {ret && (
            <div className="mt-3">
              {ret.status === "rejected" ? (
                <p className="text-sm font-semibold text-co-danger">Return not approved. Message us if you have questions.</p>
              ) : (
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
                  {RETURN_FLOW.map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-2", i <= retStep ? "text-forest" : "text-ink-muted")}>
                      <span className={cn("size-2 rounded-full", i <= retStep ? "bg-forest" : "bg-co-border-strong")} />
                      {RETURN_LABEL[s]}
                      {i < RETURN_FLOW.length - 1 && <span className="text-co-border-strong">—</span>}
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-1 text-xs text-ink-muted">
                Return requested {formatDateTime(ret.createdAt, { time: false })} · {ret.reason}
              </p>
            </div>
          )}

          {closes && canReturn && (
            <p className="mt-2 text-xs text-ink-muted">Return window closes on {closes}.</p>
          )}
        </div>

        {(canCancel || canReturn) && (
          <div className="flex flex-col gap-2 sm:w-48">
            {canReturn && (
              <ReturnRequest
                orderNo={o.orderNo}
                orderId={o.id}
                daysLeft={o.returnDaysLeft!}
                lines={o.items.map((i) => ({
                  variantKey: i.variantKey,
                  title: shortTitle(i.title),
                  variant: i.variant,
                  qty: i.qty,
                  eligible: (accountConfig.returnEligibleCategories as readonly string[]).includes(
                    o.categories[i.handle] ?? "",
                  ),
                }))}
              />
            )}
            {canCancel && <CancelOrderButton orderId={o.id} orderNo={o.orderNo} paidOnline={paidOnline} />}
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-28 shrink-0 whitespace-nowrap text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-ink">{children}</dd>
    </div>
  );
}

function paymentMethod(o: AccountOrderDetail) {
  if (o.method === "cod") return "Cash on delivery";
  const p = o.payment;
  if (!p?.mode) return `Online (${p?.provider === "cashfree" ? "Cashfree" : "PayU"})`;
  const mode = PAY_MODES[p.mode] ?? p.mode;
  if ((p.mode === "CC" || p.mode === "DC") && p.card) return `Card ••••${p.card.replace(/\D/g, "").slice(-4)}`;
  if (p.bank && p.mode === "UPI") return `UPI · ${formatName(p.bank.toLowerCase())}`;
  return mode;
}

function paymentStatus(o: AccountOrderDetail, captured: boolean, refunded: number) {
  if (refunded > 0 && refunded >= o.total) return <span className="font-semibold text-orange-700">Refunded</span>;
  if (refunded > 0) return <span className="font-semibold text-orange-700">Partly refunded</span>;
  if (o.method === "cod")
    return o.status === "delivered" ? (
      <span className="font-semibold text-co-success">Paid on delivery ✓</span>
    ) : o.status === "cancelled" ? (
      "Not paid"
    ) : (
      "Pay on delivery"
    );
  if (captured) return <span className="font-semibold text-co-success">Paid ✓</span>;
  if (o.status === "payment_failed") return <span className="font-semibold text-co-danger">Failed</span>;
  return "Not paid";
}

function PriceCard({ o, ui, refunded }: { o: AccountOrderDetail; ui: StatusUi; refunded: number }) {
  const mrpOff = Math.max(0, o.mrpTotal - o.subtotal);
  const saved = mrpOff + o.discount;
  return (
    <section className={card} aria-labelledby="price-h">
      <h2 id="price-h" className="text-base font-bold text-ink">
        Price details
      </h2>
      <dl className="mt-3 space-y-2.5 text-sm tabular-nums">
        <Row label="MRP total">{formatMoney(o.mrpTotal)}</Row>
        {mrpOff > 0 && (
          <Row label="Discount on MRP">
            <span className="text-co-success">−{formatMoney(mrpOff)}</span>
          </Row>
        )}
        {o.discount > 0 && (
          <Row label={o.couponCode ? `Coupon` : "Discount"}>
            <span className="text-co-success">
              {o.couponCode && <span className="mr-1 font-mono text-xs text-ink-muted">{o.couponCode}</span>}−
              {formatMoney(o.discount)}
            </span>
          </Row>
        )}
        <Row label="Shipping">
          {o.shipping > 0 ? formatMoney(o.shipping) : <span className="font-semibold text-co-success">FREE</span>}
        </Row>
        {o.codFee > 0 && <Row label="COD fee">{formatMoney(o.codFee)}</Row>}
        <div className="flex items-center justify-between border-t border-line pt-3 text-base font-extrabold text-ink">
          <dt>{o.method === "cod" && !["delivered", "cancelled"].includes(o.status) ? "To pay" : "Total"}</dt>
          <dd>{formatMoney(o.total)}</dd>
        </div>
        {refunded > 0 && (
          <>
            <Row label="Refunded">
              <span className="text-orange-700">−{formatMoney(refunded)}</span>
            </Row>
            <div className="flex items-center justify-between text-base font-extrabold text-ink">
              <dt>Net paid</dt>
              <dd>{formatMoney(Math.max(0, o.total - refunded))}</dd>
            </div>
          </>
        )}
      </dl>
      {ui.showSavings && saved > 0 ? (
        <p className="mt-3 rounded-xl bg-co-success/10 px-3 py-2 text-center text-sm font-semibold text-co-success">
          You saved {formatMoney(saved)} on this order
        </p>
      ) : !ui.showSavings ? (
        <p className="mt-3 rounded-xl bg-page px-3 py-2 text-center text-sm text-ink-muted">
          Order value {formatMoney(o.total)}
        </p>
      ) : null}
    </section>
  );
}
