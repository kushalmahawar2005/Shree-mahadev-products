"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";

export type DetailTab = { id: string; title: string; body: React.ReactNode };

/** Product details inside the buy column: hairline accordion, first panel open (same on every screen). */
export function DetailsTabs({ tabs }: { tabs: DetailTab[] }) {
  return (
    <Accordion type="single" collapsible defaultValue={tabs[0]?.id} className="border-t border-line">
      {tabs.map((t) => (
        <AccordionItem key={t.id} value={t.id} className="border-line">
          <AccordionTrigger className="py-4 text-[15px] font-semibold text-ink hover:no-underline">{t.title}</AccordionTrigger>
          <AccordionContent className="pb-5 text-[15px] leading-relaxed text-ink-muted">{t.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
