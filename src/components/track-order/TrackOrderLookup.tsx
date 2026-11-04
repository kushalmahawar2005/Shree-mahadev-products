"use client";

import { useState, useTransition, type FormEvent } from "react";
import { lookupTrackingAction } from "@/lib/tracking-actions";
import type { TrackingSummary } from "@/lib/server/tracking";
import { buttonClass } from "@/components/ui/Button";
import { whatsappLink } from "@/data/site";

const prettyDate = (value: string) => {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date);
};

function TrackingDetails({ tracking }: { tracking: TrackingSummary }) {
  const current = tracking.events.at(-1)?.status ?? tracking.status;
  const helpUrl = whatsappLink(`Hi, I need help with order ${tracking.orderNo}.`);
  const externalTracking = tracking.trackingUrl?.startsWith("https://") ? tracking.trackingUrl : null;
  return <section aria-labelledby="tracking-result-title" className="mt-8 rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-mustard">Order {tracking.orderNo}</p>
        <h2 id="tracking-result-title" className="mt-1 text-2xl font-semibold text-forest">{tracking.events.at(-1)?.label ?? tracking.status}</h2>
      </div>
      <span className="rounded-full bg-khaki-soft px-3 py-1.5 text-xs font-semibold text-forest">{current.replace(/[_-]+/g, " ")}</span>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-khaki-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Delivery address</p>
        <p className="mt-1 text-sm text-ink">{tracking.maskedAddress}</p>
      </div>
      <div className="rounded-2xl bg-khaki-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Courier details</p>
        {tracking.courier || tracking.awb ? <p className="mt-1 text-sm text-ink">{tracking.courier ?? "Courier"}{tracking.awb ? ` · AWB ${tracking.awb}` : ""}</p> : <p className="mt-1 text-sm text-ink-muted">Courier details will appear after dispatch.</p>}
        <p className="mt-1 text-sm text-ink-muted">Expected delivery: {tracking.expectedDelivery ? prettyDate(tracking.expectedDelivery) : "Not shared by courier yet"}</p>
        {externalTracking && <a href={externalTracking} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-forest underline underline-offset-4">Open courier tracking</a>}
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

    <a href={helpUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md", "mt-6 w-full sm:w-auto")}>
      Need help? WhatsApp us
    </a>
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
    <form onSubmit={submit} className="mt-8 rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-semibold text-forest">Find your order</h2>
      <p className="mt-1 text-sm text-ink-muted">Enter the order number from your confirmation and the phone number used at checkout.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink">
          Order number
          <input name="orderNo" autoComplete="off" required maxLength={32} placeholder="SMP..." className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-forest focus:ring-2 focus:ring-forest/15" />
        </label>
        <label className="text-sm font-semibold text-ink">
          Phone number
          <input name="phone" type="tel" inputMode="numeric" autoComplete="tel" required maxLength={16} placeholder="10-digit mobile number" className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-forest focus:ring-2 focus:ring-forest/15" />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-sale/10 p-3 text-sm text-sale">{error}</p>}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-5 w-full sm:w-auto")}>
        {pending ? "Looking up…" : "Track order"}
      </button>
    </form>
    {tracking && <TrackingDetails tracking={tracking} />}
  </>;
}
