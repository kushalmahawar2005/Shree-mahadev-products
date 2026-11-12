import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackOrderLookup } from "@/components/track-order/TrackOrderLookup";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";
import { lookupTrackingByToken } from "@/lib/server/tracking";

export const metadata: Metadata = pageMetadata({
  title: "Track your order",
  description: "Check the status of your Swadeshi Mahadev Products order.",
  path: "/track-order",
});

export default function TrackOrderPage({
  searchParams,
}: PageProps<"/track-order">) {
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-2xl px-4 pt-8 pb-10 md:pt-12 md:pb-24">
        <p className="font-hindi text-lg text-sale" lang="hi">
          आपका ऑर्डर कहाँ है?
        </p>
        <h1 className="text-3xl md:text-5xl">Track your order</h1>
        <p className="mt-3 text-ink-muted">
          Use your order number and the phone used at checkout, or open the
          tracking link from your email.
        </p>
        <Suspense
          fallback={
            <div
              className="mt-8 h-64 animate-pulse rounded-3xl bg-white/60"
              aria-label="Loading tracking form"
            />
          }
        >
          <TrackingSection searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Can&apos;t find it? Call or WhatsApp {site.phone}, {site.supportHours}
          .
        </p>
      </div>
    </div>
  );
}

async function TrackingSection({
  searchParams,
}: {
  searchParams: PageProps<"/track-order">["searchParams"];
}) {
  const params = await searchParams;
  const token = typeof params.t === "string" ? params.t : "";
  const initial = token
    ? await lookupTrackingByToken(token)
    : { tracking: null, error: null };
  return (
    <TrackOrderLookup
      initialTracking={initial.tracking}
      initialError={initial.error}
    />
  );
}
