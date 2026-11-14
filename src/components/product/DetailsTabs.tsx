"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";

export type DetailTab = { id: string; title: string; body: React.ReactNode };

/** Product details (and the PDP FAQs): one hairline accordion, every panel closed on load. */
export function DetailsTabs({ tabs, className }: { tabs: DetailTab[]; className?: string }) {
  return (
    <Accordion type="multiple" className={className ?? "border-t border-line"}>
      {tabs.map((t) => (
        <AccordionItem key={t.id} value={t.id} className="border-line">
          <AccordionTrigger className="py-4 text-base font-bold text-ink hover:no-underline">{t.title}</AccordionTrigger>
          <AccordionContent className="pb-6 text-[15px] leading-relaxed text-ink-muted">{t.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
