"use client";

import { createContext, useContext, useDeferredValue, useMemo, useState } from "react";
import { ArrowDown, MessageCircle, Search, X } from "lucide-react";
import { faqPlain, type FaqEntry } from "@/content/faqs";
import { whatsappLink } from "@/data/site";

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

export function HelpSearchBox({ name }: { name: string }) {
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
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-1 text-sm">
            {matches.length ? (
              <>
                <span className="text-ink-muted">
                  {matches.length} {matches.length === 1 ? "answer" : "answers"} found
                </span>
                <a href="#help-faq" className="inline-flex min-h-11 items-center gap-1 font-semibold text-forest-text hover:underline">
                  Jump to answers <ArrowDown className="size-3.5" />
                </a>
              </>
            ) : (
              <>
                <span className="text-ink-muted">No results. Ask us on WhatsApp.</span>
                <a
                  href={whatsappLink(`Hi, I'm ${name}. I have a question: ${q.trim()}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-4 font-semibold text-white hover:bg-forest-mid"
                >
                  <MessageCircle className="size-4" /> Ask on WhatsApp
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
