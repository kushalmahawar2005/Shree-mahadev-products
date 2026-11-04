import type { Metadata } from "next";
import { BulkForm } from "@/components/BulkForm";
import { Container } from "@/components/ui/primitives";
import { getProducts } from "@/lib/commerce";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Bulk orders: 5L & 15L tins",
  description:
    "Wood-pressed oil in 5L and 15L tins for restaurants, caterers and retailers. Send an inquiry on WhatsApp.",
  path: "/bulk-orders",
});

export default async function BulkOrdersPage() {
  const products = await getProducts({ collection: "wood-pressed-oils" });
  return (
    <Container className="grid gap-12 py-14 md:grid-cols-2 md:py-20">
      <div>
        <h1 className="text-4xl md:text-5xl">Bulk orders</h1>
        <p className="mt-4 text-lg text-ink-muted">
          For restaurants, caterers, sweet shops and retailers. We supply
          wood-pressed oil in 5L and 15L tins.
        </p>
        <ul className="mt-6 space-y-2 text-ink">
          <li>· 5L and 15L tins of groundnut and mustard oil</li>
          <li>· Regular monthly supply on request</li>
          <li>· TODO(client): bulk pricing, minimum order, delivery areas</li>
        </ul>
      </div>
      <div className="rounded-[var(--radius-card)] bg-khaki-soft p-6 md:p-8">
        <h2 className="text-2xl">Send an inquiry</h2>
        <p className="mt-1 text-sm text-ink-muted">
          We’ll save your inquiry for the team, then open WhatsApp with your
          details filled in.
        </p>
        <BulkForm products={products.map((p) => p.title)} />
      </div>
    </Container>
  );
}
