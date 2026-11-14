import { Suspense } from "react";
import { connection } from "next/server";
import { HelpdeskWorkspace, type HelpdeskTab } from "@/components/admin/helpdesk/HelpdeskWorkspace";
import { Skeleton } from "@/components/shadcn/skeleton";
import { buildFaqs } from "@/content/faqs";
import { requireAdmin } from "@/lib/server/admin-auth";
import { listFaqFeedback, listReturns, listTickets, listWaitlist } from "@/lib/server/helpdesk";
import { getStoreSettings } from "@/lib/server/store-settings";

export const metadata = { title: "Help desk" };
export const instant = false;

const TABS: HelpdeskTab[] = ["returns", "tickets", "waitlist", "faq"];

export default function HelpdeskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <HelpdeskData searchParams={searchParams} />
    </Suspense>
  );
}

async function HelpdeskData({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  await connection();
  const [returns, tickets, waitlist, feedback, settings, sp] = await Promise.all([
    listReturns(),
    listTickets(),
    listWaitlist(),
    listFaqFeedback(),
    getStoreSettings(),
    searchParams,
  ]);
  const questions = new Map(buildFaqs(settings.shipping).map((f) => [f.id, f.question]));
  const faqs = feedback.map((f) => ({ ...f, question: questions.get(f.faqId) ?? f.faqId }));
  const tab = TABS.includes(sp.tab as HelpdeskTab) ? (sp.tab as HelpdeskTab) : undefined;
  return <HelpdeskWorkspace returns={returns} tickets={tickets} waitlist={waitlist} faqs={faqs} initialTab={tab} />;
}
