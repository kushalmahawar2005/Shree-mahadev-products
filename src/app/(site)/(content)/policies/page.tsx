import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { content } from "@/content";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Store policies",
  description: "Shipping, refund & return, privacy and terms for Swadeshi Mahadev Products.",
  path: "/policies",
});

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** /policies used to 404 (only /policies/[slug] existed): a simple index of every policy. */
export default function PoliciesIndex() {
  return (
    <Container className="max-w-3xl py-12 md:py-16">
      <p className="text-sm font-semibold text-mustard">Policies</p>
      <h1 className="mt-2 text-4xl text-forest-text md:text-5xl">Store policies</h1>
      <p className="mt-3 text-lg text-ink-muted">Plain-language rules for shipping, returns, refunds and your data.</p>
      <ul className="mt-8 grid gap-3">
        {content.policies.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/policies/${p.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-5 transition-colors hover:border-forest/40 hover:bg-ivory"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-forest-text">{p.title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{p.description}</span>
                <span className="mt-1.5 block text-xs text-ink-muted/80">Updated {dateFmt.format(new Date(`${p.updated}T00:00:00+05:30`))}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-forest transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
