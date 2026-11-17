import { NextResponse } from "next/server";
import { buildFaqs } from "@/content/faqs";
import { content } from "@/content/registry";
import { proof } from "@/data/home";
import { getStoreSettings } from "@/lib/server/store-settings";

/** Help tab data: public FAQs, policy links and published lab reports. */
export async function GET() {
  const settings = await getStoreSettings();
  const faqs = buildFaqs(settings.shipping)
    .filter((faq) => !faq.accountOnly)
    .map(({ id, category, question, answer }) => ({ id, category, question, answer }));
  const policies = content.policies.map((entry) => ({ title: entry.title, href: `/policies/${entry.slug}` }));
  const reports = proof.reports.map((report) => ({ name: report.name, reportNo: report.reportNo, href: "/lab-reports" }));
  return NextResponse.json({ faqs, policies, reports }, { headers: { "Cache-Control": "public, max-age=300" } });
}
