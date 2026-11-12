"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BookOpenText, ThumbsDown, ThumbsUp } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { FAQ_CATEGORIES, type FaqCategory, type FaqEntry } from "@/content/faqs";
import { faqFeedbackAction } from "@/lib/account/support-actions";
import { cn } from "@/lib/utils/cn";
import { useHelpSearch } from "./HelpSearch";
import { Highlight, Md } from "./Md";

const card = "rounded-3xl border border-line bg-white p-5 shadow-co-card md:p-6";

/** FAQ card: category tabs (desktop) / scroll chips (mobile); the page search overrides tabs. */
export function HelpFaq({ faqs }: { faqs: FaqEntry[] }) {
  const reduce = useReducedMotion();
  const { term, matches } = useHelpSearch();
  const [cat, setCat] = useState<FaqCategory>("orders");
  const [open, setOpen] = useState("");
  const searching = Boolean(term);
  const shown = searching ? (matches ?? []) : faqs.filter((f) => f.category === cat);
  const label = (id: FaqCategory) => FAQ_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <section id="help-faq" aria-labelledby="help-faq-title" className={cn(card, "scroll-mt-24")}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-co-accent-soft text-co-accent-ink">
          <BookOpenText className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="help-faq-title" className="text-xl text-ink">
            {searching ? "Matching answers" : "Common questions"}
          </h2>
          <p className="text-sm text-ink-muted">{searching ? "Across all topics" : "Short answers, straight from our team."}</p>
        </div>
      </div>

      {!searching && (
        <div className="no-scrollbar -mx-5 mt-4 overflow-x-auto px-5 md:mx-0 md:px-0">
          <div role="tablist" aria-label="FAQ topics" className="flex w-max gap-1 rounded-full border border-line bg-page p-1 md:w-auto md:flex-wrap">
            {FAQ_CATEGORIES.map((c) => {
              const on = cat === c.id;
              return (
                <button
                  key={c.id}
                  role="tab"
                  id={`faq-tab-${c.id}`}
                  aria-selected={on}
                  aria-controls="faq-panel"
                  type="button"
                  onClick={() => {
                    setCat(c.id);
                    setOpen("");
                  }}
                  className="relative h-11 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap"
                >
                  {on && (
                    <motion.span
                      layoutId="help-faq-tab"
                      className="absolute inset-0 rounded-full bg-white shadow-co-card ring-1 ring-line"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className={cn("relative", on ? "text-ink" : "text-ink-muted")}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div id="faq-panel" role={searching ? undefined : "tabpanel"} aria-labelledby={searching ? undefined : `faq-tab-${cat}`} className="mt-2">
        {shown.length ? (
          <Accordion type="single" collapsible value={open} onValueChange={setOpen}>
            {shown.map((f) => (
              <AccordionItem key={f.id} value={f.id} className="border-line">
                <AccordionTrigger className="min-h-12 py-4 text-left text-base font-semibold text-ink hover:no-underline">
                  <span>
                    {searching && <span className="mb-0.5 block text-xs font-semibold text-co-accent-ink">{label(f.category)}</span>}
                    <Highlight text={f.question} term={term} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-[15px] leading-relaxed text-ink-muted">
                  <p>
                    <Md text={f.answer} term={term} />
                  </p>
                  <Helpful id={f.id} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="py-8 text-center text-sm text-ink-muted">No answers match that. Try another word, or ask us on WhatsApp.</p>
        )}
      </div>
    </section>
  );
}

const KEY = (id: string) => `smp_faq_fb_${id}`;

/** "Was this helpful?" 👍 👎 — counted once per browser (localStorage flag). */
function Helpful({ id }: { id: string }) {
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY(id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read a per-browser flag after mount (SSR has no localStorage)
      if (v === "up" || v === "down") setVoted(v);
    } catch {
      /* storage blocked: allow voting */
    }
  }, [id]);

  const vote = (v: "up" | "down") => {
    if (voted) return;
    setVoted(v);
    try {
      localStorage.setItem(KEY(id), v);
    } catch {
      /* ignore */
    }
    void faqFeedbackAction({ id, helpful: v === "up" }).catch(() => {});
  };

  const btn = (v: "up" | "down") =>
    cn(
      "inline-grid size-11 place-items-center rounded-full border transition-colors",
      voted === v ? "border-forest bg-co-brand-soft text-forest-text" : "border-line text-ink-muted hover:text-ink",
      voted && voted !== v && "opacity-50",
    );

  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span aria-live="polite">{voted ? "Thanks for the feedback." : "Was this helpful?"}</span>
      <button type="button" aria-label="Yes, helpful" aria-pressed={voted === "up"} disabled={Boolean(voted)} onClick={() => vote("up")} className={btn("up")}>
        <ThumbsUp className="size-4" />
      </button>
      <button type="button" aria-label="Not helpful" aria-pressed={voted === "down"} disabled={Boolean(voted)} onClick={() => vote("down")} className={btn("down")}>
        <ThumbsDown className="size-4" />
      </button>
    </div>
  );
}
