"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, PenLine, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { submitProductReviewAction } from "@/lib/review-actions";
import { cn } from "@/lib/utils/cn";

const field =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10";
const LABELS = ["", "Poor", "Okay", "Good", "Very good", "Loved it"];

type Cat = "oil" | "honey" | "sweetener";
// Tap-to-fill starters, by product type and how happy the customer is. They only fill the box; people edit freely.
const SUGGEST: Record<Cat, { good: { title: string[]; body: string[] }; mid: { title: string[]; body: string[] }; low: { title: string[]; body: string[] } }> = {
  oil: {
    good: {
      title: ["Asli kachi ghani swad", "Pure and fresh", "Will order again"],
      body: ["Smells exactly like ghani oil should.", "Food tastes like home again.", "Thick, fresh oil and neat packing.", "Using it daily for cooking and tadka."],
    },
    mid: { title: ["Good oil", "Decent quality"], body: ["Quality is good.", "Taste is fine.", "Delivery could be faster."] },
    low: { title: ["Not as expected"], body: ["Packing was damaged.", "Taste was different from what I expected.", "Delivery was late."] },
  },
  honey: {
    good: {
      title: ["Real raw honey", "Loved the taste", "Will order again"],
      body: ["Thick and naturally sweet.", "Crystallised in winter, which shows it's raw.", "Great with warm water in the morning.", "Kids love it."],
    },
    mid: { title: ["Good honey", "Decent quality"], body: ["Taste is good.", "A bit pricey but good quality.", "Delivery could be faster."] },
    low: { title: ["Not as expected"], body: ["Jar was leaking.", "Taste was different from what I expected.", "Delivery was late."] },
  },
  sweetener: {
    good: {
      title: ["Pure desi taste", "Healthy swap for sugar", "Will order again"],
      body: ["Tastes just like village gur.", "Using it in chai every day.", "Clean, no added colour.", "Great for halwa and laddoo."],
    },
    mid: { title: ["Good product", "Decent quality"], body: ["Taste is good.", "Texture could be finer.", "Delivery could be faster."] },
    low: { title: ["Not as expected"], body: ["Pack was damaged.", "Taste was different from what I expected.", "Delivery was late."] },
  },
};

/** "Write a review" button + shadcn Dialog form, right on the product page. */
export function WriteReview({ productHandle, productTitle, category = "oil" }: { productHandle: string; productTitle: string; category?: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();

  function submit(form: HTMLFormElement) {
    const v = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "").trim();
    if (!rating) return setError("Tap the stars to give a rating.");
    setError("");
    start(async () => {
      const r = await submitProductReviewAction({ productHandle, name: v("name"), city: v("city"), rating, title: v("title"), body: v("body"), website: v("website") });
      if (r.ok) setDone(r.message ?? "Thank you!");
      else setError(r.error ?? "Couldn't send your review.");
    });
  }

  const shown = hover || rating;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const pool = SUGGEST[(category in SUGGEST ? category : "oil") as Cat][rating >= 4 ? "good" : rating === 3 ? "mid" : "low"];
  const addToBody = (line: string) => setBody((b) => (b.includes(line) ? b : `${b.trim()} ${line}`.trim()));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && done) {
          setDone("");
          setRating(0);
          setTitle("");
          setBody("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[#e8c879] px-4 text-sm font-bold text-forest-deep hover:bg-white">
          <PenLine className="size-4" /> Write a review
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-3xl bg-white sm:max-w-lg">
        {done ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="size-14 text-forest" strokeWidth={1.5} />
            <DialogTitle className="mt-4 text-2xl">Review received</DialogTitle>
            <DialogDescription className="mt-2">{done}</DialogDescription>
            <button type="button" onClick={() => setOpen(false)} className="mt-6 h-11 rounded-full bg-forest px-6 text-sm font-bold text-white">
              Done
            </button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Review {productTitle.replace(/^(Wood|Cold)-Pressed\s+/, "")}</DialogTitle>
              <DialogDescription>Honest reviews help other families choose. We check every review before it goes live.</DialogDescription>
            </DialogHeader>
            <form
              className="mt-2 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit(e.currentTarget);
              }}
            >
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Your rating</p>
                <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      onMouseEnter={() => setHover(n)}
                      onClick={() => setRating(n)}
                      className="rounded-md p-0.5 transition-transform hover:scale-110"
                    >
                      <Star className={cn("size-8", n <= shown ? "fill-[#f5b400] text-[#f5b400]" : "fill-line text-line")} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-semibold text-forest-text">{LABELS[shown]}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Your name</span>
                  <input name="name" required maxLength={120} autoComplete="name" className={field} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">City (optional)</span>
                  <input name="city" maxLength={80} autoComplete="address-level2" className={field} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Headline (optional)</span>
                <input name="title" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Asli kachi ghani swad" className={field} />
                {rating > 0 && <Chips items={pool.title} active={(t) => t === title} onPick={setTitle} />}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Your review</span>
                <textarea name="body" required minLength={10} maxLength={3000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Taste, smell, how you used it…" className={cn(field, "h-auto py-3 leading-relaxed")} />
                {rating > 0 && <Chips items={pool.body} active={(t) => body.includes(t)} onPick={addToBody} plus />}
              </label>
              {/* Honeypot, hidden from people */}
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
              {error && (
                <p role="alert" className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={pending} className="btn-shine inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest text-sm font-bold text-white hover:bg-forest-mid disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" />} Submit review
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Chips({ items, active, onPick, plus }: { items: string[]; active: (t: string) => boolean; onPick: (t: string) => void; plus?: boolean }) {
  return (
    <span className="mt-2 flex flex-wrap gap-1.5">
      {items.map((t) => {
        const on = active(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted hover:border-forest/40 hover:text-forest",
            )}
          >
            {plus && !on ? "+ " : ""}
            {t}
          </button>
        );
      })}
    </span>
  );
}
