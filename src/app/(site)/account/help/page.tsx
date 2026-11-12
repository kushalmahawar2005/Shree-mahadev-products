import { connection } from "next/server";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/account/ui";
import { ContactCard, PolicyLinks } from "@/components/account/help/ContactCard";
import { HelpFaq } from "@/components/account/help/HelpFaq";
import { HelpFlow } from "@/components/account/help/HelpFlow";
import { HelpSearchBox, HelpSearchProvider } from "@/components/account/help/HelpSearch";
import { toHelpOption } from "@/components/account/help/help-lib";
import { buildFaqs, faqJsonLd } from "@/content/faqs";
import { whatsappLink } from "@/data/site";
import { primaryBtn } from "@/lib/account/ui-classes";
import { getProducts } from "@/lib/commerce";
import { getAccountShell, queryAccountOrders } from "@/lib/server/account";
import { getStoreSettings } from "@/lib/server/store-settings";
import { listSupportTickets } from "@/lib/server/support-tickets";
import { cn } from "@/lib/utils/cn";
import { formatName, formatPhone } from "@/lib/utils/format";

export const metadata = { title: "Help & support", robots: { index: false } };
// Per-session data: render per request (the layout opt-out does not cover sibling pages).
export const instant = false;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function HelpPage({ searchParams }: { searchParams: SP }) {
  await connection();
  const shell = await getAccountShell();
  if (!shell) return null; // layout redirects
  const c = shell.customer;
  const sp = await searchParams;
  const preselect = typeof sp.order === "string" ? sp.order.slice(0, 20) : null;

  const [page, tickets, products, settings] = await Promise.all([
    queryAccountOrders(c.id, { tab: "all", q: "", range: "all" }),
    listSupportTickets(c.id),
    getProducts(),
    getStoreSettings(),
  ]);
  const faqs = buildFaqs(settings.shipping);
  const images = Object.fromEntries(products.map((p) => [p.handle, p.images[0]?.url ?? ""]));
  const wa = whatsappLink(`Hi, I'm ${formatName(c.name)} (${formatPhone(c.phone)}). I need help with…`);

  return (
    <div className="pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }} />
      <PageHeader eyebrow="मदद" title="Help & support" subtitle="Quick answers, help with an order, and how to reach us." />
      <HelpSearchProvider faqs={faqs}>
        <div className="mb-5 lg:mb-6">
          <HelpSearchBox name={c.name} />
        </div>
        <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
          <div className="space-y-5 lg:col-span-7 lg:space-y-6">
            <HelpFlow
              orders={page.orders.slice(0, 5).map(toHelpOption)}
              hasMore={page.orders.length > 5 || page.nextCursor !== null}
              preselect={preselect}
              images={images}
              tickets={tickets}
            />
            <HelpFaq faqs={faqs} />
          </div>
          <aside className="space-y-5 lg:sticky lg:top-24 lg:col-span-5 lg:space-y-6 lg:self-start">
            <ContactCard name={c.name} phone={c.phone} />
            <PolicyLinks />
          </aside>
        </div>
      </HelpSearchProvider>

      {/* Phone: always-reachable WhatsApp */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(primaryBtn, "whitespace-nowrap")}>
          <MessageCircle className="size-4" /> Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
