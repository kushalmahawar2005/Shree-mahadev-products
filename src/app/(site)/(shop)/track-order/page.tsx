import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/primitives";
import { TrackOrderLookup } from "@/components/track-order/TrackOrderLookup";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";
import { lookupTrackingByToken } from "@/lib/server/tracking";

export const metadata: Metadata = pageMetadata({
  title: "Track your order",
  description: "Check the status of your Swadeshi Mahadev Products order.",
  path: "/track-order",
});

export default function TrackOrderPage({ searchParams }: PageProps<"/track-order">) {
  return (
    <Container className="max-w-2xl py-12 md:py-16">
      <h1 className="text-4xl md:text-5xl">Track your order</h1>
      <p className="mt-4 text-lg text-ink-muted">
        Check the latest progress with your order number and checkout phone, or open the secure tracking link from your email.
      </p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-khaki-soft" aria-label="Loading tracking form" />}>
        <TrackingSection searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-sm text-ink-muted">
        Support: {site.phone}, {site.supportHours}.
      </p>
    </Container>
  );
}

async function TrackingSection({ searchParams }: { searchParams: PageProps<"/track-order">["searchParams"] }) {
  const params = await searchParams;
  const token = typeof params.t === "string" ? params.t : "";
  const initial = token ? await lookupTrackingByToken(token) : { tracking: null, error: null };
  return <TrackOrderLookup initialTracking={initial.tracking} initialError={initial.error} />;
}
