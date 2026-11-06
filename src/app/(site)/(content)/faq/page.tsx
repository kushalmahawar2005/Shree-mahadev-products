import type { Metadata } from "next";
import { MessageCircle, Phone } from "lucide-react";
import { FaqBrowser, type Faq } from "@/components/faq/FaqBrowser";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { site, whatsappLink } from "@/data/site";
import { formatMoney } from "@/lib/utils/money";
import { jsonLdString, pageMetadata } from "@/lib/utils/seo";
import { getStoreSettings } from "@/lib/server/store-settings";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description: "Answers about kachi ghani oil, shipping, COD and orders.",
  path: "/faq",
});

const CATS = ["Products", "Orders & delivery", "Payments", "Help"];

export default async function FaqPage() {
  const { shipping } = await getStoreSettings();
  // Shipping / COD answers come from live store settings, so they never go stale.
  const faqs: Faq[] = [
    { cat: "Products", q: "What is kachi ghani (wood-pressed) oil?", a: "Oil pressed slowly in a ghani, without external heat or chemicals, and not refined afterwards.", link: { href: "/our-ghani", label: "See how we press" } },
    { cat: "Products", q: "Why does the oil smell stronger than supermarket oil?", a: "Because it is not deodorised. The smell and taste are those of the seed itself." },
    { cat: "Products", q: "There is sediment at the bottom of my bottle. Is that OK?", a: "Yes. Unrefined oil can carry fine seed particles. It is natural and safe." },
    { cat: "Products", q: "My honey has crystallised. Is it still good?", a: "Yes. Raw honey can set in cold weather. Stand the jar in warm (not hot) water to make it runny again." },
    { cat: "Products", q: "Are your products lab tested?", a: "Yes. You can read the test reports for our oils and our FSSAI licence on the lab reports page.", link: { href: "/lab-reports", label: "View lab reports" } },
    {
      cat: "Orders & delivery",
      q: "How much is shipping?",
      a: `Shipping is free on orders above ${formatMoney(shipping.freeShippingThreshold)}. Below that, the charge depends on your pincode and is shown at checkout as soon as you enter it, along with the estimated delivery time.`,
    },
    { cat: "Orders & delivery", q: "How do I track my order?", a: "Use your order number and the phone number you used at checkout, or open the tracking link in your confirmation email.", link: { href: "/track-order", label: "Track an order" } },
    { cat: "Orders & delivery", q: "Do you ship outside India?", a: "No, we currently ship within India only." },
    { cat: "Orders & delivery", q: "Can I order in bulk for my shop or restaurant?", a: "Yes. We supply 5 L and 15 L tins and can set up regular supply.", link: { href: "/bulk-orders", label: "Send a bulk inquiry" } },
    {
      cat: "Payments",
      q: "Do you offer cash on delivery?",
      a: shipping.codEnabled
        ? `Yes, COD is available${shipping.codMaxOrder ? ` on orders up to ${formatMoney(shipping.codMaxOrder)}` : ""} for serviceable pincodes. Any COD charge is shown at checkout before you place the order.`
        : "Not at the moment. You can pay online with UPI, cards, net banking or wallets.",
    },
    { cat: "Payments", q: "Which payment methods do you accept?", a: "UPI, debit and credit cards, net banking and wallets, processed securely by PayU." },
    { cat: "Payments", q: "My money was deducted but the order shows unpaid.", a: "Please don't pay again. Payments can take a few minutes to confirm. If it still shows unpaid, WhatsApp us your order number and we'll check it with PayU." },
    { cat: "Help", q: "How can I reach you?", a: `Call or WhatsApp ${site.phone} between ${site.supportHours}, or email ${site.email}.`, link: { href: "/contact", label: "All contact options" } },
    { cat: "Help", q: "What is your return and refund policy?", a: "Read the full policy for damaged, leaking or wrong items and how refunds work.", link: { href: "/policies/refund-return", label: "Refund & returns policy" } },
  ];

  return (
    <div className="bg-[#F5EDDE]">
      <div className="mx-auto max-w-[900px] px-4 pt-6 pb-16 md:px-8 md:pt-8 md:pb-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }),
          }}
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>FAQ</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="mt-6">
          <p className="font-hindi text-lg text-sale" lang="hi">
            आपके सवाल
          </p>
          <h1 className="text-3xl md:text-5xl">Questions, answered</h1>
          <p className="mt-3 text-ink-muted md:text-lg">About our oils, delivery, payments and more.</p>
        </header>

        <FaqBrowser faqs={faqs} cats={CATS} />

        <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl bg-forest p-6 text-white sm:flex-row sm:items-center md:p-8">
          <div>
            <h2 className="text-2xl text-white">Still have a question?</h2>
            <p className="mt-1 text-sm text-white/70">Real people reply, {site.supportHours}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={whatsappLink("Hi, I have a question.")} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#e8c879] px-5 text-sm font-bold text-forest-deep hover:bg-white">
              <MessageCircle className="size-4" /> WhatsApp us
            </a>
            <a href={site.phoneHref} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-semibold hover:bg-white/10">
              <Phone className="size-4" /> Call
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
