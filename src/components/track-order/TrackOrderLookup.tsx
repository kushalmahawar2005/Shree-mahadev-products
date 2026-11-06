"use client";

import { useState, useTransition, type FormEvent } from "react";
import { lookupTrackingAction } from "@/lib/tracking-actions";
import type { TrackingSummary } from "@/lib/server/tracking";
import { Check, ExternalLink, Loader2, MapPin, MessageCircle, PackageCheck, PackageSearch, Truck } from "lucide-react";
import { whatsappLink } from "@/data/site";

const prettyDate = (value: string) => {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date);
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
  return <section aria-labelledby="tracking-result-title" className="mt-6 overflow-hidden rounded-3xl border border-line bg-white">
    <div className="relative overflow-hidden bg-forest p-5 text-white sm:p-7">
      <span aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(circle,rgba(180,144,36,0.45),transparent_65%)]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-white/60">Order <span className="font-mono text-white">{tracking.orderNo}</span></p>
          <h2 id="tracking-result-title" className="mt-1 text-2xl text-white">{tracking.events.at(-1)?.label ?? pretty(tracking.status)}</h2>
        </div>
        <span className="rounded-full bg-[#e8c879] px-3 py-1.5 text-xs font-bold text-forest-deep capitalize">{current.replace(/[_-]+/g, " ")}</span>
      </div>
    </div>
    <div className="p-5 sm:p-7">
    {STEP_OF[tracking.status] !== undefined && (
      <ol className="mb-6 grid grid-cols-4">
        {STEPS.map((st, i) => {
          const step = STEP_OF[tracking.status];
          const done = i <= step;
          const I = st.icon;
          return (
            <li key={st.label} className="relative flex flex-col items-center gap-2 text-center">
              {i > 0 && <span className={`absolute top-5 right-1/2 h-0.5 w-full -translate-y-1/2 ${i <= step ? "bg-forest" : "bg-line"}`} />}
              <span className={`relative z-10 grid size-10 place-items-center rounded-full border-2 ${done ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted"} ${i === step ? "ring-4 ring-forest/15" : ""}`}>
                <I className="size-4" />
              </span>
              <span className={`text-xs font-semibold ${done ? "text-forest-text" : "text-ink-muted"}`}>{st.label}</span>
            </li>
          );
        })}
      </ol>
    )}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-subtle p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted"><MapPin className="size-3.5" /> Delivery address</p>
        <p className="mt-1 text-sm text-ink">{tracking.maskedAddress}</p>
      </div>
      <div className="rounded-2xl bg-subtle p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted"><Truck className="size-3.5" /> Courier</p>
        {tracking.courier || tracking.awb ? <p className="mt-1 text-sm text-ink">{tracking.courier ?? "Courier"}{tracking.awb ? ` · AWB ${tracking.awb}` : ""}</p> : <p className="mt-1 text-sm text-ink-muted">Courier details will appear after dispatch.</p>}
        <p className="mt-1 text-sm text-ink-muted">Expected delivery: {tracking.expectedDelivery ? prettyDate(tracking.expectedDelivery) : "Not shared by courier yet"}</p>
        {externalTracking && <a href={externalTracking} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-forest underline underline-offset-4">Open courier tracking <ExternalLink className="size-3.5" /></a>}
      </div>
    </div>

    <div className="mt-7">
      <h3 className="text-lg font-semibold text-ink">Order updates</h3>
      {tracking.events.length ? <ol className="mt-4 space-y-0">
        {[...tracking.events].reverse().map((event, index) => <li key={`${event.status}-${event.at}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
          {index < tracking.events.length - 1 && <span aria-hidden="true" className="absolute left-[9px] top-5 h-full w-px bg-line" />}
          <span aria-hidden="true" className={`relative mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${index === 0 ? "border-forest bg-forest" : "border-line bg-white"}`} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-semibold text-ink">{event.label}</span>
              <time className="text-xs text-ink-muted">{prettyDate(event.at)}</time>
            </span>
            {event.location && <span className="mt-1 block text-sm text-ink-muted">{event.location}</span>}
          </span>
        </li>)}
      </ol> : <p className="mt-3 text-sm text-ink-muted">Updates will appear here as your order moves along.</p>}
    </div>

    <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-semibold text-forest-text hover:border-forest/40 sm:w-auto">
      <MessageCircle className="size-4" /> Need help? WhatsApp us
    </a>
    </div>
  </section>;
}

export function TrackOrderLookup({ initialTracking, initialError }: { initialTracking: TrackingSummary | null; initialError: string | null }) {
  const [tracking, setTracking] = useState(initialTracking);
  const [error, setError] = useState(initialError);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await lookupTrackingAction({ orderNo: String(data.get("orderNo") ?? ""), phone: String(data.get("phone") ?? "") });
      setTracking(result.tracking);
      setError(result.error);
    });
  }

  return <>
    <form onSubmit={submit} className="mt-8 rounded-3xl border border-line bg-white p-5 shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)] sm:p-7">
      <h2 className="flex items-center gap-2 text-xl"><PackageSearch className="size-5 text-forest/60" /> Find your order</h2>
      <p className="mt-1 text-sm text-ink-muted">Enter the order number from your confirmation and the phone number used at checkout.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-[13px] font-medium text-ink-muted">
          Order number
          <input name="orderNo" autoComplete="off" required maxLength={32} placeholder="SMP..." className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-4 font-normal outline-none transition-[border-color,box-shadow] focus:border-forest focus:ring-4 focus:ring-forest/10" />
        </label>
        <label className="text-[13px] font-medium text-ink-muted">
          Phone number
          <input name="phone" type="tel" inputMode="numeric" autoComplete="tel" required maxLength={16} placeholder="10-digit mobile number" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-4 font-normal outline-none transition-[border-color,box-shadow] focus:border-forest focus:ring-4 focus:ring-forest/10" />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-alert-soft p-3 text-sm text-alert">{error}</p>}
      <button type="submit" disabled={pending} className="btn-shine mt-5 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-7 text-sm font-bold text-white hover:bg-forest-mid disabled:opacity-60 sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} {pending ? "Looking up…" : "Track order"}
      </button>
    </form>
    {tracking && <TrackingDetails tracking={tracking} />}
  </>;
}
