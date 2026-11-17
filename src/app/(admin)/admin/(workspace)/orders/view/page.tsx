import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  FileText,
  History,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  Truck,
  Undo2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ShipmentPanel } from "@/components/admin/ShipmentPanel";
import { RefundPanel } from "@/components/admin/RefundPanel";
import { OrderEmails } from "@/components/admin/OrderEmails";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { StatusBadge } from "@/components/admin/ui";
import { PaymentPanel } from "@/components/admin/order/PaymentPanel";
import { CopyButton } from "@/components/admin/order/CopyButton";
import { Skeleton } from "@/components/shadcn/skeleton";
import { getProduct } from "@/lib/commerce";
import { nimbusConfigured } from "@/lib/server/nimbuspost";
import { AttentionBanner } from "@/components/admin/order/AttentionBanner";
import { getOrderById, getOrderEvents, listRefunds, refundableFor, type Order, type OrderStatus } from "@/lib/server/orders";
import { getOrderExtras } from "@/lib/server/order-detail";
import { returnForOrder } from "@/lib/server/helpdesk";
import { estimateWeightGrams } from "@/lib/server/shipping";
import { listShipments } from "@/lib/server/shipments";
import { listOrderEmails, mailConfigured } from "@/lib/server/mail";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Order" };

/** Invoices are only issued for orders that were actually sold. */
const NO_INVOICE: OrderStatus[] = ["pending_payment", "payment_failed", "cancelled", "rto", "refunded", "partially_refunded"];

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";

export default function OrderView({ searchParams }: PageProps<"/admin/orders/view">) {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <OrderDetail searchParams={searchParams} />
    </Suspense>
  );
}

function OrderSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading order">
      <Skeleton className="h-10 w-72 bg-surface" />
      <Skeleton className="h-24 rounded-2xl bg-surface" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          <Skeleton className="h-72 rounded-2xl bg-surface" />
          <Skeleton className="h-60 rounded-2xl bg-surface" />
        </div>
        <Skeleton className="h-96 rounded-2xl bg-surface" />
      </div>
    </div>
  );
}

const when = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(
    new Date(d.replace(" ", "T") + "+05:30"),
  );
const short = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d.replace(" ", "T") + "+05:30"));

async function OrderDetail({ searchParams }: { searchParams: PageProps<"/admin/orders/view">["searchParams"] }) {
  const id = Number((await searchParams).id);
  const order = Number.isInteger(id) && id > 0 ? await getOrderById(id).catch(() => null) : null;
  if (!order) {
    return (
      <div className={cn(card, "mx-auto max-w-md p-8 text-center")}>
        <p className="font-semibold text-forest-text">Order not found</p>
        <Link href="/admin/orders" className="mt-3 inline-flex text-sm font-semibold text-forest-fg hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const [shipments, events, emails, refundable, refunds, extras, products, ret] = await Promise.all([
    listShipments(order.id),
    getOrderEvents(order.id),
    listOrderEmails(order.id),
    order.paymentMethod === "payu" ? refundableFor(order.id) : Promise.resolve(null),
    listRefunds(order.id),
    getOrderExtras(order),
    Promise.all(order.items.map((i) => getProduct(i.productHandle).catch(() => undefined))),
    returnForOrder(order.id),
  ]);

  // Prefill packed weight from the catalog (admin can edit before booking).
  let weight = 0;
  order.items.forEach((i, idx) => {
    const v = products[idx]?.variants.find((x) => x.id === i.variantKey);
    const packed = (v as { weightGrams?: number | null } | undefined)?.weightGrams;
    weight += packed ? packed * i.quantity : v ? estimateWeightGrams(v.sizeValue, v.sizeUnit, i.quantity) : 500 * i.quantity;
  });

  const a = order.address;
  const label = ORDER_LABEL[order.status];
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  const paidOnline = extras.payments.some((p) => p.status === "success" || p.status === "refunded");
  const paymentText =
    order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod === "offline" ? "Paid offline" : paidOnline ? "Paid online · PayU" : "Online · not paid yet";
  const canInvoice = !NO_INVOICE.includes(order.status);
  const fullAddress = `${a.name}\n${a.line1}${a.line2 ? `, ${a.line2}` : ""}\n${a.city}, ${a.state} ${a.pincode}\n+91 ${a.phone}`;
  const waText = encodeURIComponent(`Namaste ${a.name.split(" ")[0]}, this is Swadeshi Mahadev Products about your order ${order.orderNo}.`);
  const defaultEmail = order.status === "delivered" ? "delivered" : ["shipped", "packed"].includes(order.status) ? "shipped" : order.status === "cancelled" ? "cancelled" : order.paymentMethod === "payu" && paidOnline ? "payment_received" : "order_placed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/orders" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-forest-fg">
            <ArrowLeft className="size-4" /> Orders
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-1 text-3xl font-bold tracking-tight text-forest-text">
              {order.orderNo}
              <CopyButton value={order.orderNo} label="order number" className="size-8" />
            </h1>
            <StatusBadge tone={label.tone}>{label.text}</StatusBadge>
            {ret && (
              <Link href="/admin/helpdesk?tab=returns" className="rounded-full transition-opacity hover:opacity-80">
                <StatusBadge tone={ret.status === "requested" ? "amber" : "gray"}>Return {ret.status}</StatusBadge>
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Placed {when(order.createdAt)} · {paymentText} · {units} item{units === 1 ? "" : "s"} · {formatMoney(order.total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://wa.me/91${a.phone}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-forest-text transition-colors hover:border-forest/50"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          {canInvoice ? (
            <a
              href={`/admin/orders/invoice?id=${order.id}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white transition-colors hover:bg-forest-mid"
            >
              <FileText className="size-4" /> {extras.invoice ? "Download invoice" : "Create invoice"}
            </a>
          ) : (
            <span title="Invoices are issued once the order is paid or COD is placed" className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-sm font-semibold text-ink-muted">
              <FileText className="size-4" /> Invoice not available
            </span>
          )}
        </div>
      </div>

      {order.attention && <AttentionBanner orderId={order.id} text={order.attention} since={order.attentionAt} />}

      <OrderProgress order={order} events={events} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          <Panel icon={Package} title="Items" aside={`${order.items.length} product${order.items.length === 1 ? "" : "s"} · ${units} unit${units === 1 ? "" : "s"}`}>
            <ul className="divide-y divide-line">
              {order.items.map((i, idx) => {
                const img = products[idx]?.images[0];
                return (
                  <li key={i.variantKey} className="flex items-center gap-4 py-3.5 first:pt-0">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-subtle ring-1 ring-line">
                      {img ? <Image src={img.url} alt="" fill sizes="56px" className="object-cover" /> : <Package className="absolute inset-0 m-auto size-5 text-ink-muted" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/products/edit?handle=${i.productHandle}`} className="block truncate font-semibold text-ink hover:text-forest-fg hover:underline">
                        {i.productTitle}
                      </Link>
                      <span className="block text-sm text-ink-muted">
                        {i.variantTitle}
                        {i.sku ? ` · ${i.sku}` : ""}
                      </span>
                    </span>
                    <span className="hidden text-sm tabular-nums text-ink-muted sm:block">
                      {formatMoney(Math.round(i.lineTotal / i.quantity))} × {i.quantity}
                    </span>
                    <span className="w-20 text-right font-semibold tabular-nums text-forest-text">{formatMoney(i.lineTotal)}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-2 space-y-2 border-t border-line pt-4 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotal)} />
              {order.discount > 0 && <Row label={order.couponCode ? `Coupon ${order.couponCode}` : "Discount"} value={`−${formatMoney(order.discount)}`} className="text-forest-fg" />}
              <Row label={`Shipping${order.courierName ? ` · ${order.courierName} quoted` : ""}`} value={order.shipping ? formatMoney(order.shipping) : "Free"} />
              {order.codFee > 0 && <Row label="COD charge" value={formatMoney(order.codFee)} />}
              <Row label="Total" value={formatMoney(order.total)} className="border-t border-line pt-3 text-base font-bold text-forest-text" />
            </dl>
          </Panel>

          <Panel icon={CreditCard} title="Payment">
            <PaymentPanel orderId={order.id} method={order.paymentMethod} status={order.status} total={order.total} attempts={extras.payments} />
            {refundable && (refundable.paid > 0 || refunds.length > 0) && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-forest-text">
                  <Undo2 className="size-4" /> Refunds
                </p>
                <RefundPanel orderId={order.id} paid={refundable.paid} left={refundable.left} refunds={refunds} />
              </div>
            )}
          </Panel>

          <Panel icon={Truck} title="Shipping" aside="NimbusPost">
            <ShipmentPanel
              orderId={order.id}
              status={order.status}
              initialShipments={shipments}
              defaultWeight={weight}
              suggestedCourierId={order.courierId}
              configured={nimbusConfigured()}
            />
          </Panel>
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-5">
          <Panel icon={UserRound} title="Customer">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest text-sm font-bold text-white">
                {a.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{a.name}</p>
                <p className="text-xs text-ink-muted">
                  {extras.customer.orders <= 1 ? "First order" : `${extras.customer.orders} orders · ${formatMoney(extras.customer.spent)} spent`}
                </p>
              </div>
              {extras.customer.customerId && (
                <Link href={`/admin/customers/view?id=${extras.customer.customerId}`} className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-forest-fg hover:underline">
                  Profile <ArrowUpRight className="size-3.5" />
                </Link>
              )}
            </div>
            <ul className="mt-4 space-y-1 text-sm">
              <ContactRow icon={Phone} href={`tel:+91${a.phone}`} text={`+91 ${a.phone}`} copy={a.phone} label="phone" />
              {a.email && <ContactRow icon={Mail} href={`mailto:${a.email}`} text={a.email} copy={a.email} label="email" />}
              <li className="flex items-start gap-3 rounded-xl px-2 py-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                <address className="min-w-0 flex-1 not-italic leading-relaxed text-ink">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                  <br />
                  {a.city}, {a.state} <span className="font-semibold">{a.pincode}</span>
                </address>
                <CopyButton value={fullAddress} label="address" />
              </li>
            </ul>
            {extras.customer.recent.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-xs font-semibold text-ink-muted">Other orders</p>
                <ul className="space-y-1">
                  {extras.customer.recent.map((o) => {
                    const l = ORDER_LABEL[o.status as keyof typeof ORDER_LABEL];
                    return (
                      <li key={o.id}>
                        <Link href={`/admin/orders/view?id=${o.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-subtle">
                          <span className="font-semibold text-forest-fg">{o.orderNo}</span>
                          <span className="text-xs text-ink-muted">{short(o.createdAt)}</span>
                          <span className="ml-auto tabular-nums text-ink">{formatMoney(o.total)}</span>
                          <span className={cn("size-2 rounded-full", l?.tone === "green" ? "bg-forest-fg" : l?.tone === "red" ? "bg-red-600" : l?.tone === "amber" ? "bg-mustard" : "bg-ink-muted/40")} title={l?.text ?? o.status} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Panel>

          <Panel icon={Receipt} title="Invoice">
            {extras.invoice ? (
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold text-ink">
                    {extras.invoice.invoiceNo}
                    <CopyButton value={extras.invoice.invoiceNo} label="invoice number" />
                  </p>
                  <p className="text-xs text-ink-muted">GST invoice · issued {short(extras.invoice.createdAt)}</p>
                </div>
                <a href={`/admin/orders/invoice?id=${order.id}`} className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-xs font-semibold text-forest-text hover:border-forest">
                  PDF
                </a>
              </div>
            ) : canInvoice ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">Not issued yet. The GST invoice number is assigned on first download.</p>
                <a href={`/admin/orders/invoice?id=${order.id}`} className="inline-flex h-9 shrink-0 items-center rounded-full bg-forest px-3.5 text-xs font-semibold text-white hover:bg-forest-mid">
                  Create
                </a>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                {order.status === "pending_payment" ? "Available once the customer pays." : "No invoice for orders that didn't go through."}
              </p>
            )}
          </Panel>

          <Panel icon={Mail} title="Customer emails">
            <OrderEmails orderId={order.id} initial={emails} hasEmail={!!a.email} configured={mailConfigured()} defaultKind={defaultEmail} />
          </Panel>

          <Panel icon={History} title="History">
            <ol className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
              {events.map((e, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={cn("absolute -left-6 top-1 size-[15px] rounded-full border-2 border-surface", i === 0 ? "bg-forest-fg ring-4 ring-forest/15" : "bg-line")} />
                  <p className="text-sm font-semibold text-ink">{ORDER_LABEL[e.to as keyof typeof ORDER_LABEL]?.text ?? e.to}</p>
                  <p className="text-xs text-ink-muted">
                    {short(e.at)} · {e.actor === "admin" ? "Admin" : e.actor === "customer" ? "Customer" : e.actor}
                  </p>
                  {e.note && <p className="mt-0.5 text-sm text-ink-muted">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ icon: Icon, title, aside, children }: { icon: LucideIcon; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className={cn(card, "p-5")}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
        <h2 className="text-base font-bold text-forest-text">{title}</h2>
        {aside && <span className="ml-auto text-xs text-ink-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-4", className)}>
      <dt className={cn(!className && "text-ink-muted")}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ContactRow({ icon: Icon, href, text, copy, label }: { icon: LucideIcon; href: string; text: string; copy: string; label: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-subtle">
      <Icon className="size-4 shrink-0 text-ink-muted" />
      <a href={href} className="min-w-0 flex-1 truncate text-ink hover:text-forest-fg">
        {text}
      </a>
      <CopyButton value={copy} label={label} />
    </li>
  );
}

/** Placed → Paid/Confirmed → Booked → In transit → Delivered, with the time each step was reached. */
function OrderProgress({ order, events }: { order: Order; events: { to: string; at: string }[] }) {
  const cod = order.paymentMethod === "cod";
  const steps: { label: string; statuses: string[] }[] = [
    { label: "Placed", statuses: [] },
    { label: cod ? "COD accepted" : "Paid", statuses: ["paid", "cod_pending", "confirmed"] },
    { label: "Shipment booked", statuses: ["packed"] },
    { label: "In transit", statuses: ["shipped"] },
    { label: "Delivered", statuses: ["delivered"] },
  ];
  // events are newest-first; the earliest matching event is when the step was reached.
  const reachedAt = (s: string[]) => events.findLast((e) => s.includes(e.to))?.at ?? null;
  const times = steps.map((s, i) => (i === 0 ? order.createdAt : reachedAt(s.statuses)));
  // A later step implies the earlier ones (e.g. delivered without a recorded "shipped" scan).
  let reached = 0;
  times.forEach((t, i) => t && (reached = i));

  const problem: Partial<Record<OrderStatus, string>> = {
    payment_failed: "Payment failed. The customer can retry from their order link.",
    cancelled: "This order was cancelled.",
    rto: "Parcel is returning to you (RTO). Mark it received once it's back to restock.",
    refunded: "This order was fully refunded.",
    partially_refunded: "Part of this order was refunded.",
  };
  const alert = problem[order.status];

  return (
    <section className={cn(card, "p-5")}>
      {alert && (
        <p className={cn("mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium", order.status === "partially_refunded" ? "bg-warm text-sale ring-1 ring-warm-line" : "bg-red-50 text-red-800")}>
          <AlertTriangle className="size-4 shrink-0" /> {alert}
        </p>
      )}
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((s, i) => {
          const done = i <= reached;
          const current = i === reached && !alert;
          return (
            <li key={s.label} className="relative flex flex-col items-center text-center">
              {i > 0 && <span aria-hidden className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", i <= reached ? "bg-forest-fg" : "bg-line")} />}
              <span
                className={cn(
                  "relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-bold",
                  done ? "border-forest-fg bg-forest-fg text-surface" : "border-line bg-surface text-ink-muted",
                  current && "ring-4 ring-forest/15",
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("mt-2 text-xs font-semibold sm:text-sm", done ? "text-forest-text" : "text-ink-muted")}>{s.label}</span>
              <span className="hidden text-[11px] text-ink-muted sm:block">{times[i] ? short(times[i]!) : done ? "Done" : "—"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export const instant = false;
