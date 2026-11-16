"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";

export type DetailTab = { id: string; title: string; body: React.ReactNode };

/** Product details (and the PDP FAQs): one hairline accordion, every panel closed on load, one open at a time. */
export function DetailsTabs({ tabs, className, itemClassName }: { tabs: DetailTab[]; className?: string; itemClassName?: string }) {
  return (
    <Accordion type="single" collapsible className={className ?? "border-t border-line"}>
      {tabs.map((t) => (
        <AccordionItem key={t.id} value={t.id} className={itemClassName ?? "border-line"}>
          <AccordionTrigger className="rounded-none py-4 text-base font-bold text-ink hover:no-underline focus-visible:ring-0">{t.title}</AccordionTrigger>
          <AccordionContent className="pb-6 text-[15px] leading-relaxed text-ink-muted">{t.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
