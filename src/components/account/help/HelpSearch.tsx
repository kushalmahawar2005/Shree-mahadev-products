"use client";

import { createContext, useContext, useDeferredValue, useMemo, useState } from "react";
import { ArrowDown, LifeBuoy, Search, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { faqPlain, type FaqEntry } from "@/content/faqs";
import { Highlight, Md } from "./Md";

type Ctx = { q: string; term: string; setQ: (v: string) => void; matches: FaqEntry[] | null };
const SearchCtx = createContext<Ctx>({ q: "", term: "", setQ: () => {}, matches: null });

export const useHelpSearch = () => useContext(SearchCtx);

const matchesTerm = (f: FaqEntry, term: string) =>
  `${f.question} ${faqPlain(f.answer)} ${f.keywords.join(" ")}`.toLowerCase().includes(term);

/** Shares the help search across the page (search box on top, FAQ card below). */
export function HelpSearchProvider({ faqs, children }: { faqs: FaqEntry[]; children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const term = deferred.trim().toLowerCase();
  const matches = useMemo(() => (term ? faqs.filter((f) => matchesTerm(f, term)) : null), [faqs, term]);
  return <SearchCtx.Provider value={{ q, term, setQ, matches }}>{children}</SearchCtx.Provider>;
}

/** Answers shown right under the search box; the rest are in the FAQ card. */
const SHOWN = 4;

export function HelpSearchBox() {
  const { q, setQ, matches, term } = useHelpSearch();
  return (
    <div className="mb-5">
      <label htmlFor="help-search" className="sr-only">
        Search help
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          id="help-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQ("")}
          placeholder="Search help… e.g. refund, COD, tracking"
          autoComplete="off"
          aria-describedby="help-search-count"
          className="h-14 w-full rounded-2xl border border-line bg-white pr-12 pl-12 text-base text-ink shadow-co-card outline-none placeholder:text-ink-muted focus:border-forest focus:ring-4 focus:ring-forest/10 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 inline-grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-page hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div id="help-search-count" aria-live="polite" className="min-h-0">
        {term && matches && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-co-card">
            {matches.length ? (
              <>
                <p className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-sm text-ink-muted">
                  <span>
                    {matches.length} {matches.length === 1 ? "answer" : "answers"} for “{q.trim()}”
                  </span>
                  {matches.length > SHOWN && (
                    <a href="#help-faq" className="inline-flex min-h-9 items-center gap-1 font-semibold text-forest-text hover:underline">
                      See all <ArrowDown className="size-3.5" />
                    </a>
                  )}
                </p>
                <Accordion type="single" collapsible defaultValue={matches[0]?.id} key={term} className="px-4">
                  {matches.slice(0, SHOWN).map((f) => (
                    <AccordionItem key={f.id} value={f.id} className="border-line last:border-b-0">
                      <AccordionTrigger className="min-h-12 py-3.5 text-left text-[15px] font-semibold text-ink hover:no-underline">
                        <span>
                          <Highlight text={f.question} term={term} />
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-[15px] leading-relaxed text-ink-muted">
                        <p>
                          <Md text={f.answer} term={term} />
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm">
                <span className="text-ink-muted">No answers for “{q.trim()}”. Raise a request and our team will help.</span>
                <a
                  href="#gh-h"
                  onClick={() => setQ("")}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-4 font-semibold text-white hover:bg-forest-mid"
                >
                  <LifeBuoy className="size-4" /> Get help
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
