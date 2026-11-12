"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { lookupTrackingAction } from "@/lib/tracking-actions";
import type { TrackingSummary } from "@/lib/server/tracking";
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
  { label: "Placed", icon: Check },
  { label: "Packed", icon: PackageCheck },
  { label: "Shipped", icon: Truck },
  { label: "Delivered", icon: MapPin },
];
const STEP_OF: Record<string, number> = { paid: 0, cod_pending: 0, confirmed: 0, packed: 1, shipped: 2, delivered: 3 };
const pretty = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function TrackingDetails({ tracking }: { tracking: TrackingSummary }) {
  const current = tracking.events.at(-1)?.status ?? tracking.status;
  const helpUrl = whatsappLink(`Hi, I need help with order ${tracking.orderNo}.`);
  const externalTracking = tracking.trackingUrl?.startsWith("https://") ? tracking.trackingUrl : null;
  const step = STEP_OF[tracking.status];
  const events = [...tracking.events].reverse();

  return (
    <section aria-labelledby="tracking-result-title" className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)]">
      {/* Status band */}
      <div className="bg-forest px-4 py-5 text-white sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/60">
              Order <span className="font-mono text-white">{tracking.orderNo}</span>
              <span className="text-white/40"> · placed {prettyDate(tracking.createdAt)}</span>
            </p>
            <h2 id="tracking-result-title" className="mt-1 text-[22px] leading-tight text-white sm:text-2xl">
              {tracking.events.at(-1)?.label ?? pretty(tracking.status)}
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-[#e8c879] px-3 py-1 text-xs font-bold text-forest-deep capitalize">{current.replace(/[_-]+/g, " ")}</span>
        </div>
      </div>

      <div className="px-4 py-5 sm:p-7">
        {/* Progress */}
        {step !== undefined && (
          <ol className="grid grid-cols-4" aria-label="Delivery progress">
            {STEPS.map((st, i) => {
              const done = i <= step;
              const I = st.icon;
              return (
                <li key={st.label} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={i === step ? "step" : undefined}>
                  {i > 0 && <span className={cn("absolute top-[18px] right-1/2 h-0.5 w-full -translate-y-1/2 sm:top-5", done ? "bg-forest" : "bg-line")} />}
                  <span
                    className={cn(
                      "relative z-10 grid size-9 place-items-center rounded-full border-2 sm:size-10",
                      done ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted",
                      i === step && "ring-4 ring-forest/15",
                    )}
                  >
                    <I className="size-4" />
                  </span>
                  <span className={cn("text-[11px] font-semibold sm:text-xs", done ? "text-forest-text" : "text-ink-muted")}>{st.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Address + courier */}
        <dl className={cn("divide-y divide-line rounded-2xl border border-line", step !== undefined && "mt-5")}>
          <div className="flex gap-3 p-4">
            <MapPin className="mt-0.5 size-4 shrink-0 text-forest/60" />
            <div className="min-w-0">
              <dt className="text-xs font-semibold text-ink-muted">Delivering to</dt>
              <dd className="mt-0.5 text-sm break-words text-ink">{tracking.maskedAddress}</dd>
            </div>
          </div>
          <div className="flex gap-3 p-4">
            <Truck className="mt-0.5 size-4 shrink-0 text-forest/60" />
            <div className="min-w-0 flex-1">
              <dt className="text-xs font-semibold text-ink-muted">Courier</dt>
              <dd className="mt-0.5 text-sm text-ink">
                {tracking.courier || tracking.awb ? (
                  <>
                    {tracking.courier ?? "Courier"}
                    {tracking.awb && <span className="font-mono text-ink-muted"> · AWB {tracking.awb}</span>}
                  </>
                ) : (
                  <span className="text-ink-muted">Details appear once it&apos;s dispatched.</span>
                )}
              </dd>
              <dd className="mt-1 text-xs text-ink-muted">
                Expected delivery: <span className="font-semibold text-ink">{tracking.expectedDelivery ? prettyDate(tracking.expectedDelivery) : "after dispatch"}</span>
              </dd>
              {externalTracking && (
                <dd className="mt-2">
                  <a href={externalTracking} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-forest underline underline-offset-4">
                    Open courier tracking <ExternalLink className="size-3.5" />
                  </a>
                </dd>
              )}
            </div>
          </div>
        </dl>

        {/* Timeline, newest first */}
        <div className="mt-6">
          <h3 className="text-base font-semibold text-ink sm:text-lg">Order updates</h3>
          {events.length ? (
            <ol className="mt-4">
              {events.map((event, index) => (
                <li key={`${event.status}-${event.at}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < events.length - 1 && <span aria-hidden="true" className="absolute top-5 left-[7px] h-full w-0.5 bg-line" />}
                  <span
                    aria-hidden="true"
                    className={cn("relative mt-1 size-4 shrink-0 rounded-full border-2", index === 0 ? "border-forest bg-forest ring-4 ring-forest/15" : "border-co-border-strong bg-white")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", index === 0 ? "text-ink" : "text-ink-muted")}>{event.label}</span>
                    <time dateTime={event.at} className="block text-xs text-ink-muted tabular-nums">
                      {prettyDateTime(event.at)}
                      {event.location ? ` · ${event.location}` : ""}
                    </time>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">Updates will appear here as your order moves along.</p>
          )}
        </div>

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

export function TrackOrderLookup({ initialTracking, initialError }: { initialTracking: TrackingSummary | null; initialError: string | null }) {
  const [tracking, setTracking] = useState(initialTracking);
  const [error, setError] = useState(initialError);
  // With a result on screen the form folds away behind "Track another order".
  const [formOpen, setFormOpen] = useState(!initialTracking);
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
      {tracking && (
        <motion.div ref={resultRef} key={tracking.orderNo} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="scroll-mt-24">
          <TrackingDetails tracking={tracking} />
        </motion.div>
      )}

      {tracking ? (
        <div className="rounded-3xl border border-line bg-white">
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            aria-expanded={formOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-forest-text sm:px-6"
          >
            <span className="flex items-center gap-2">
              <PackageSearch className="size-4 text-forest/60" /> Track another order
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
