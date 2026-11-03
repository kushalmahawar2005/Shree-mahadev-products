import type { Metadata } from "next";
import { Accordion } from "@/components/ui/Accordion";
import { Container } from "@/components/ui/primitives";
import { site } from "@/data/site";
import { jsonLdString, pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description: "Answers about kachi ghani oil, shipping, COD and orders.",
  path: "/faq",
});

const faqs = [
  {
    q: "What is kachi ghani (wood-pressed) oil?",
    a: "Oil pressed slowly in a wooden ghani, without external heat or chemicals, and not refined afterwards.",
  },
  {
    q: "Why does the oil smell stronger than supermarket oil?",
    a: "Because it is not deodorised. The smell and taste are those of the seed itself.",
  },
  {
    q: "There is sediment at the bottom of my bottle. Is that OK?",
    a: "Yes. Unrefined oil can carry fine seed particles. It is natural and safe.",
  },
  {
    q: "Do you offer cash on delivery?",
    a: "Yes, COD is available. TODO(client): COD charges, if any.",
  },
  {
    q: "How much is shipping?",
    a: `Shipping is free on orders above ₹${site.freeShippingThreshold}. TODO(client): charges below that and delivery times.`,
  },
  {
    q: "Do you ship outside India?",
    a: "No, we currently ship within India only.",
  },
  {
    q: "How can I reach you?",
    a: `Call or WhatsApp ${site.phone} between ${site.supportHours}, or email ${site.email}.`,
  },
];

export default function FaqPage() {
  return (
    <Container className="max-w-3xl py-14 md:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <h1 className="text-4xl md:text-5xl">Frequently asked questions</h1>
      <Accordion items={faqs.map((f) => ({ title: f.q, content: <p>{f.a}</p> }))} className="mt-10" />
    </Container>
  );
}
