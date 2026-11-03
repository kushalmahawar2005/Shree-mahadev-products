import type { Metadata } from "next";
import { Container } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/Button";
import { site, whatsappLink } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Track your order",
  description: "Check the status of your Swadeshi Mahadev Products order.",
  path: "/track-order",
});

export default function TrackOrderPage() {
  return (
    <Container className="max-w-2xl py-12 md:py-16">
      <h1 className="text-4xl md:text-5xl">Track your order</h1>
      <p className="mt-4 text-lg text-ink-muted">
        Open the link on your order confirmation page, or message us on WhatsApp with your order number (it starts with SMP).
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {/* TODO(client): Shopify customer account URL / Shiprocket tracking page */}
        <a href="#" aria-disabled className={buttonClass("primary", "lg", "pointer-events-none opacity-60")}>
          My orders (coming soon)
        </a>
        <a
          href={whatsappLink("Hi, I'd like to know the status of my order. Order number: ")}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("secondary", "lg")}
        >
          Ask on WhatsApp
        </a>
      </div>
      <p className="mt-6 text-sm text-ink-muted">
        Support: {site.phone}, {site.supportHours}.
      </p>
    </Container>
  );
}
