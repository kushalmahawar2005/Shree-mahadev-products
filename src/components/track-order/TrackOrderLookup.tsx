"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { lookupTrackingAction } from "@/lib/tracking-actions";
import Link from "next/link";
import type { MyTrackableOrder, TrackingSummary } from "@/lib/server/tracking";
import { formatMoney } from "@/lib/utils/money";
import { Check, ChevronDown, ExternalLink, Loader2, PackageSearch } from "lucide-react";
import { MapPin, MessageCircle, PackageCheck, Phone, Truck } from "@/components/icons/duo";
import { site, whatsappLink } from "@/data/site";
import { cn } from "@/lib/utils/cn";

const toDate = (value: string) => new Date(value.replace(" ", "T"));
const prettyDate = (value: string) => {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date);
};
const prettyDateTime = (value: string) => {
  const date = toDate(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(date);
};

const STEPS = [
  { key: "ordered", label: "Ordered", icon: Check },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "outForDelivery", label: "Out for delivery", icon: PackageCheck },
  { key: "delivered", label: "Delivered", icon: MapPin },
] as const;

const dayKey = (value: string) => {
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
};
const dayLabel = (value: string) => {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return value;
  const today = dayKey(new Date().toISOString().replace("T", " "));
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString().replace("T", " "));
  const k = dayKey(value);
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
};
const timeOnly = (value: string) => {
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
};
const longDay = (value: string) => {
  const d = new Date(`${value.slice(0, 10)}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
};

/** Big headline like Amazon: where the parcel is / when it arrives. */
function headline(t: TrackingSummary): { title: string; sub: string | null } {
  const s = t.status;
  if (s === "cancelled") return { title: "Order cancelled", sub: null };
  if (s === "refunded" || s === "partially_refunded") return { title: s === "refunded" ? "Refund issued" : "Part refund issued", sub: null };
  if (s === "rto") return { title: "Returning to us", sub: "The courier couldn't deliver this parcel. We'll contact you." };
  if (s === "pending_payment") return { title: "Waiting for payment", sub: null };
  if (s === "payment_failed") return { title: "Payment didn't go through", sub: null };
  if (t.stage === 3) return { title: t.milestones.delivered ? `Delivered ${dayLabel(t.milestones.delivered).toLowerCase() === "today" ? "today" : `on ${longDay(t.milestones.delivered)}`}` : "Delivered", sub: null };
  if (t.stage === 2) return { title: "Out for delivery", sub: "Arriving today" };
  if (t.stage === 1) return { title: t.expectedDelivery ? `Arriving ${longDay(t.expectedDelivery)}` : "On the way", sub: t.scans.at(-1)?.line ?? null };
  return { title: "Order confirmed", sub: "We're packing it. It usually leaves our warehouse within 1–2 days." };
}

function CopyAwb({ awb }: { awb: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(awb).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
      className="ml-1 rounded-full px-2 py-0.5 text-xs font-semibold text-forest hover:bg-forest/5"
      aria-label={`Copy AWB ${awb}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function TrackingDetails({ tracking }: { tracking: TrackingSummary }) {
  const helpUrl = whatsappLink(`Hi, I need help with order ${tracking.orderNo}.`);
  const externalTracking = tracking.trackingUrl?.startsWith("https://") ? tracking.trackingUrl : null;
  const head = headline(tracking);
  const stage = tracking.stage;
  // Courier scans grouped by day, newest day and newest scan first.
  const groups: { day: string; label: string; items: { line: string; at: string }[] }[] = [];
  for (const scan of [...tracking.scans].reverse()) {
    const key = dayKey(scan.at);
    const g = groups.at(-1);
    if (g && g.day === key) g.items.push(scan);
    else groups.push({ day: key, label: dayLabel(scan.at), items: [scan] });
  }
  const dispatched = Boolean(tracking.courier || tracking.awb);

  return (
    <section aria-labelledby="tracking-result-title" className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)]">
      {/* Headline */}
      <div className="bg-forest px-4 py-5 text-white sm:p-7">
        <p className="text-xs font-semibold text-white/60">
          Order <span className="font-mono text-white">{tracking.orderNo}</span>
          <span className="text-white/40"> · placed {prettyDate(tracking.createdAt)}</span>
        </p>
        <h2 id="tracking-result-title" className="mt-1 text-[24px] leading-tight text-white sm:text-3xl">{head.title}</h2>
        {head.sub && <p className="mt-1 text-sm text-white/80">{head.sub}</p>}
      </div>

      <div className="px-4 py-5 sm:p-7">
        {/* Progress: Ordered → Shipped → Out for delivery → Delivered, with the date each was reached */}
        {stage !== null && (
          <ol className="grid grid-cols-4" aria-label="Delivery progress">
            {STEPS.map((st, i) => {
              const done = i <= stage;
              const when = tracking.milestones[st.key];
              const I = st.icon;
              return (
                <li key={st.key} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={i === stage ? "step" : undefined}>
                  {i > 0 && <span className={cn("absolute top-[18px] right-1/2 h-0.5 w-full -translate-y-1/2 sm:top-5", done ? "bg-forest" : "bg-line")} />}
                  <span
                    className={cn(
                      "relative z-10 grid size-9 place-items-center rounded-full border-2 sm:size-10",
                      done ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted",
                      i === stage && "ring-4 ring-forest/15",
                    )}
                  >
                    <I className="size-4" />
                  </span>
                  <span className={cn("text-[11px] leading-tight font-semibold sm:text-xs", done ? "text-forest-text" : "text-ink-muted")}>{st.label}</span>
                  <span className="min-h-[1em] text-[10.5px] text-ink-muted tabular-nums sm:text-[11px]">{done && when ? prettyDate(when).replace(/ \d{4}$/, "") : ""}</span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Courier */}
        <dl className={cn("divide-y divide-line rounded-2xl border border-line", stage !== null && "mt-5")}>
          <div className="flex gap-3 p-4">
            <Truck className="mt-0.5 size-4 shrink-0 text-forest/60" />
            <div className="min-w-0 flex-1">
              <dt className="text-xs font-semibold text-ink-muted">Courier</dt>
              {dispatched ? (
                <>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{tracking.courier ?? "Courier partner"}</dd>
                  {tracking.awb && (
                    <dd className="mt-0.5 flex items-center text-sm text-ink-muted">
                      AWB <span className="ml-1 font-mono text-ink">{tracking.awb}</span>
                      <CopyAwb awb={tracking.awb} />
                    </dd>
                  )}
                  {externalTracking && (
                    <dd className="mt-2">
                      <a href={externalTracking} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-forest underline underline-offset-4">
                        Track on {tracking.courier ?? "the courier"}&apos;s website <ExternalLink className="size-3.5" />
                      </a>
                    </dd>
                  )}
                </>
              ) : (
                <dd className="mt-0.5 text-sm text-ink-muted">Courier name and AWB number show here as soon as we hand your parcel over.</dd>
              )}
            </div>
          </div>
          <div className="flex gap-3 p-4">
            <MapPin className="mt-0.5 size-4 shrink-0 text-forest/60" />
            <div className="min-w-0">
              <dt className="text-xs font-semibold text-ink-muted">Delivering to</dt>
              <dd className="mt-0.5 text-sm break-words text-ink">{tracking.maskedAddress}</dd>
            </div>
          </div>
        </dl>

        {/* Courier updates, grouped by day (like Amazon's "See all updates") */}
        <div className="mt-6">
          <h3 className="text-base font-semibold text-ink sm:text-lg">Shipment updates</h3>
          {groups.length ? (
            <div className="mt-3 space-y-4">
              {groups.map((g, gi) => (
                <div key={g.day}>
                  <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">{g.label}</p>
                  <ol className="mt-2">
                    {g.items.map((item, ii) => {
                      const latest = gi === 0 && ii === 0;
                      const last = gi === groups.length - 1 && ii === g.items.length - 1;
                      return (
                        <li key={`${item.at}-${ii}`} className="relative flex gap-3 pb-4 last:pb-0">
                          {!last && <span aria-hidden="true" className="absolute top-5 left-[7px] h-full w-0.5 bg-line" />}
                          <span aria-hidden="true" className={cn("relative mt-1 size-4 shrink-0 rounded-full border-2", latest ? "border-forest bg-forest ring-4 ring-forest/15" : "border-co-border-strong bg-white")} />
                          <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                            <span className={cn("text-sm", latest ? "font-semibold text-ink" : "text-ink")}>{item.line}</span>
                            <time dateTime={item.at} className="shrink-0 text-xs text-ink-muted tabular-nums">{timeOnly(item.at)}</time>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              {dispatched ? "The courier hasn't scanned the parcel yet. Updates appear here within a few hours of pickup." : "Courier updates appear here once your parcel is picked up."}
            </p>
          )}
        </div>

        {/* Order history (customer-facing steps only, each once) */}
        {tracking.history.length > 0 && (
          <details className="group mt-5 rounded-2xl border border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-forest-text">
              Order history
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="space-y-2 px-4 pb-4">
              {[...tracking.history].reverse().map((h, i) => (
                <li key={`${h.label}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">{h.label}</span>
                  <time dateTime={h.at} className="shrink-0 text-xs text-ink-muted tabular-nums">{prettyDateTime(h.at)}</time>
                </li>
              ))}
            </ol>
          </details>
        )}

        {/* Help */}
        <div className="mt-6 rounded-2xl bg-subtle p-4">
          <p className="text-sm font-semibold text-ink">Need help with this order?</p>
          <p className="text-xs text-ink-muted">We reply {site.supportHours}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-4 text-sm font-bold text-white hover:bg-forest-mid"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
            <a href={site.phoneHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-forest-text hover:border-forest/40">
              <Phone className="size-4" /> Call
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const inputCls =
  "mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-4 text-base font-normal text-ink outline-none transition-[border-color,box-shadow] focus:border-forest focus:ring-4 focus:ring-forest/10 md:text-sm";

const DONE = new Set(["delivered", "cancelled", "refunded", "rto"]);
const statusTone = (status: string) =>
  status === "delivered" ? "bg-forest/10 text-forest-text" : DONE.has(status) ? "bg-black/5 text-ink-muted" : "bg-mustard/15 text-sale";

/**
 * Signed-in shopper: their recent orders as one-tap cards (each opens /track-order?t=<token>, the same
 * secure link as in emails). Active orders first so "where is my parcel" is one tap.
 */
function MyOrdersPicker({ orders, selected }: { orders: MyTrackableOrder[]; selected: string | null }) {
  const sorted = [...orders].sort((a, b) => Number(DONE.has(a.status)) - Number(DONE.has(b.status)));
  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)] sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-forest-text sm:text-xl">
        <PackageSearch className="size-5 text-forest" /> Your orders
      </h2>
      <p className="mt-0.5 text-sm text-ink-muted">Tap an order to see where it is.</p>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {sorted.map((o) => {
          const active = o.token === selected;
          return (
            <li key={o.token}>
              <Link
                href={`/track-order?t=${o.token}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group flex h-full flex-col gap-1.5 rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-200",
                  active ? "border-forest bg-forest/[0.04] shadow-[0_0_0_1px_var(--color-forest)]" : "border-line hover:border-forest/40 hover:bg-ivory",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold text-forest-text">{o.orderNo}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", statusTone(o.status))}>{o.label}</span>
                </span>
                <span className="truncate text-sm text-ink">
                  {o.firstItem ?? "Order"}
                  {o.items > 1 ? <span className="text-ink-muted"> +{o.items - 1} more</span> : null}
                </span>
                <span className="flex items-center justify-between text-xs text-ink-muted">
                  <span>{prettyDate(o.createdAt)}</span>
                  <span className="font-semibold text-ink tabular-nums">{formatMoney(o.total)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TrackOrderLookup({
  initialTracking,
  initialError,
  myOrders = [],
  selectedToken = null,
}: {
  initialTracking: TrackingSummary | null;
  initialError: string | null;
  myOrders?: MyTrackableOrder[];
  selectedToken?: string | null;
}) {
  const [tracking, setTracking] = useState(initialTracking);
  const [error, setError] = useState(initialError);
  const signedIn = myOrders.length > 0;
  // With a result on screen (or the shopper's own orders to pick from) the form folds away.
  const [formOpen, setFormOpen] = useState(!initialTracking && !signedIn);
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await lookupTrackingAction({ orderNo: String(data.get("orderNo") ?? ""), phone: String(data.get("phone") ?? "") });
      setTracking(result.tracking);
      setError(result.error);
      if (result.tracking) {
        setFormOpen(false);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    });
  }

  // nested = inside the "Track another order" fold: no card chrome or heading of its own.
  const renderForm = (nested: boolean) => (
    <form
      onSubmit={submit}
      className={cn(nested ? "px-4 pt-1 pb-4 sm:px-6 sm:pb-6" : "rounded-3xl border border-line bg-white p-4 shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)] sm:p-7")}
    >
      {!nested && (
        <>
          <h2 className="flex items-center gap-2 text-lg sm:text-xl">
            <PackageSearch className="size-5 text-forest/60" /> Find your order
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Order number from your confirmation + the phone used at checkout.</p>
        </>
      )}
      <div className={cn(!nested && "mt-4 sm:mt-5", "grid gap-3 sm:grid-cols-2 sm:gap-4")}>
        <label className="text-[13px] font-medium text-ink-muted">
          Order number
          <input name="orderNo" autoComplete="off" autoCapitalize="characters" required maxLength={32} placeholder="e.g. SMP1317" className={cn(inputCls, "uppercase placeholder:normal-case")} />
        </label>
        <label className="text-[13px] font-medium text-ink-muted">
          Phone number
          <input name="phone" type="tel" inputMode="numeric" autoComplete="tel" required maxLength={16} placeholder="10-digit mobile number" className={inputCls} />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-alert-soft p-3 text-sm text-alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn-shine mt-5 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-7 text-sm font-bold text-white hover:bg-forest-mid disabled:opacity-60 sm:w-auto"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} {pending ? "Looking up…" : "Track order"}
      </button>
    </form>
  );

  return (
    <div className="mt-6 space-y-4 sm:mt-8">
      {signedIn && <MyOrdersPicker orders={myOrders} selected={selectedToken} />}
      {tracking && (
        <motion.div ref={resultRef} key={tracking.orderNo} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="scroll-mt-24">
          <TrackingDetails tracking={tracking} />
        </motion.div>
      )}

      {tracking || signedIn ? (
        <div className="rounded-3xl border border-line bg-white">
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            aria-expanded={formOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-forest-text sm:px-6"
          >
            <span className="flex items-center gap-2">
              <PackageSearch className="size-4 text-forest/60" /> {signedIn ? "Track with an order number" : "Track another order"}
            </span>
            <ChevronDown className={cn("size-4 transition-transform", formOpen && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {formOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                {renderForm(true)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        renderForm(false)
      )}
    </div>
  );
}
