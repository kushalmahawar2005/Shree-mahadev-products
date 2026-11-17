import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackOrderLookup } from "@/components/track-order/TrackOrderLookup";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";
import { listMyTrackableOrders, lookupTrackingByToken } from "@/lib/server/tracking";
import { getCustomerSession } from "@/lib/server/customer-auth";

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
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-10 md:pt-12 md:pb-24">
        <p className="font-hindi text-base text-sale md:text-lg" lang="hi">
          आपका ऑर्डर कहाँ है?
        </p>
        <h1 className="text-[28px] leading-tight md:text-5xl">Track your order</h1>
        <p className="mt-2 text-sm text-ink-muted md:mt-3 md:text-base">
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
  const [initial, session] = await Promise.all([
    token ? lookupTrackingByToken(token) : Promise.resolve({ tracking: null, error: null }),
    getCustomerSession().catch(() => null),
  ]);
  // Signed in: their recent orders as one-tap cards (no order number / phone to type).
  const myOrders = session ? await listMyTrackableOrders(session.id).catch(() => []) : [];
  return (
    <>
      <TrackOrderLookup
        // Remount per order so picking another card shows its tracking (state is seeded from props).
        key={token || "form"}
        initialTracking={initial.tracking}
        initialError={initial.error}
        myOrders={myOrders}
        selectedToken={token || null}
      />
      {/* The result card has its own help buttons; this line is for the empty form. */}
      {!initial.tracking && (
        <p className="mt-6 text-center text-sm text-ink-muted">
          Can&apos;t find it? Call or WhatsApp{" "}
          <a href={site.phoneHref} className="font-semibold text-forest-text whitespace-nowrap">
            {site.phone}
          </a>
          , {site.supportHours}.
        </p>
      )}
    </>
  );
}
