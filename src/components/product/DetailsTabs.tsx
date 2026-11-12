"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";

export type DetailTab = { id: string; title: string; body: React.ReactNode };

/** Product details: tabs on desktop, accordion on phones (same content). */
export function DetailsTabs({ tabs }: { tabs: DetailTab[] }) {
  return (
    <>
      <Tabs defaultValue={tabs[0]?.id} className="hidden md:flex">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-full border border-line bg-white p-1">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-10 flex-none rounded-full px-5 text-sm font-semibold text-ink-muted data-[state=active]:bg-forest data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              {t.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-6 rounded-3xl border border-line bg-white p-8 text-[16px] leading-relaxed text-ink">
            {t.body}
          </TabsContent>
        ))}
      </Tabs>
      <Accordion type="single" collapsible defaultValue={tabs[0]?.id} className="rounded-3xl border border-line bg-white px-5 md:hidden">
        {tabs.map((t) => (
          <AccordionItem key={t.id} value={t.id} className="border-line">
            <AccordionTrigger className="py-4 text-base font-semibold text-ink hover:no-underline">{t.title}</AccordionTrigger>
            <AccordionContent className="pb-5 text-[15px] leading-relaxed text-ink">{t.body}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
