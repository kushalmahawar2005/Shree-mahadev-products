import type { Metadata } from "next";
import Link from "next/link";
import { Container, SwatchDot } from "@/components/ui/primitives";
import { getProducts } from "@/lib/commerce";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Lab reports",
  description: "Lab test reports for our wood-pressed oils, raw honey and natural sweeteners.",
  path: "/lab-reports",
});

export default async function LabReportsPage() {
  const products = await getProducts();
  return (
    <Container className="max-w-4xl py-14 md:py-20">
      <h1 className="text-4xl md:text-5xl">Lab reports</h1>
      <p className="mt-4 text-lg text-ink-muted">
        Read the test report for any product. TODO(client): upload lab report PDFs for each product.
      </p>
      <ul className="mt-10 divide-y divide-line border-y border-line">
        {products.map((p) => (
          <li key={p.handle} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <Link href={`/products/${p.handle}`} className="flex items-center gap-3 font-semibold text-forest-text hover:underline">
              <SwatchDot color={p.swatch} className="size-4" />
              {p.title}
              <span className="text-sm font-normal text-ink-muted" lang="hi">
                {p.titleHi}
              </span>
            </Link>
            {p.labReportUrl ? (
              <a href={p.labReportUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline">
                View PDF
              </a>
            ) : (
              <span className="text-sm text-ink-muted">Report coming soon</span>
            )}
          </li>
        ))}
      </ul>
    </Container>
  );
}
