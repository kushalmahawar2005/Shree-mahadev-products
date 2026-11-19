import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "@/components/icons/duo";
import { LabReportsBrowser } from "@/components/proof/LabReportsBrowser";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { proof } from "@/data/home";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Lab reports",
  description: "Lab test reports for our wood-pressed oils and our FSSAI licence.",
  path: "/lab-reports",
});

export default function LabReportsPage() {
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-10 md:px-8 md:pt-8 md:pb-24">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Lab reports</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="mt-6 max-w-2xl">
          <p className="font-hindi text-lg text-sale" lang="hi">
            जांचा-परखा
          </p>
          <h1 className="text-3xl md:text-5xl">Tested, and here to read</h1>
          <p className="mt-3 text-ink-muted md:text-lg">Every report below was issued to Mahadev Products. Open any one and read it in full.</p>
        </header>

        <LabReportsBrowser reports={proof.reports} lab={proof.lab} fssaiNo={proof.fssaiNo} fssaiValidTill={proof.fssaiValidTill} />

        {/* TODO(client): honey, jaggery and groundnut oil reports issued to Mahadev Products. */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-3xl border border-line bg-white p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-forest-text">Need a report that isn&apos;t listed?</p>
            <p className="text-sm text-ink-muted">Ask us for the latest report on any product and we&apos;ll share it with you.</p>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-forest-mid"
          >
            <MessageCircle className="size-4" /> Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
