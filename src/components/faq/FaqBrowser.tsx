"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Search, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { cn } from "@/lib/utils/cn";

export type Faq = { q: string; a: string; cat: string; link?: { href: string; label: string } };

/** FAQ with category pills (motion layoutId) + live search + shadcn accordion. */
export function FaqBrowser({ faqs, cats }: { faqs: Faq[]; cats: string[] }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = faqs.filter((f) => (cat === "All" || f.cat === cat) && (!term || `${f.q} ${f.a}`.toLowerCase().includes(term)));

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <div role="tablist" aria-label="Topic" className="flex w-max gap-1 rounded-full bg-white/70 p-1">
            {["All", ...cats].map((c) => {
              const on = cat === c;
              return (
                <button key={c} role="tab" type="button" aria-selected={on} onClick={() => setCat(c)} className="relative h-9 rounded-full px-4 text-sm font-semibold">
                  {on && <motion.span layoutId="faq-cat" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                  <span className={cn("relative", on ? "text-white" : "text-forest-text")}>{c}</span>
                </button>
              );
            })}
          </div>
        </div>
        <label className="relative md:ml-auto md:w-72">
          <span className="sr-only">Search questions</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions…"
            className="h-11 w-full rounded-full border border-line bg-white pr-9 pl-10 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      {shown.length ? (
        <Accordion type="single" collapsible defaultValue={shown[0] ? shown[0].q : undefined} className="mt-6 rounded-3xl border border-line bg-white px-5 md:px-7">
          {shown.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="border-line">
              <AccordionTrigger className="py-5 text-left text-base font-semibold text-forest-text hover:no-underline md:text-lg">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-[15px] leading-relaxed text-ink">
                <p>{f.a}</p>
                {f.link && (
                  <Link href={f.link.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline">
                    {f.link.label} <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <p className="mt-6 rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink-muted">
          No questions match &ldquo;{q}&rdquo;. Try another word or ask us below.
        </p>
      )}
    </div>
  );
}
