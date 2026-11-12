"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { BadgeCheck, Star, ThumbsUp } from "lucide-react";
import { markReviewHelpfulAction } from "@/lib/review-helpful-action";
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn/dialog";
import { SmartImage } from "@/components/ui/SmartImage";
import type { PublicReview } from "@/lib/server/reviews";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatName } from "@/lib/utils/format";

type Filter = "all" | "photos" | 1 | 2 | 3 | 4 | 5;
const PAGE = 6;

/** This product's reviews: filter (photos / stars), sort, load more, photo lightbox. */
export function ReviewList({ reviews }: { reviews: PublicReview[] }) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"recent" | "helpful" | "high" | "low">("recent");
  // Votes from this browser (remembered so a shopper votes once per review).
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from localStorage after hydration
      setVoted(JSON.parse(localStorage.getItem("smp_helpful") ?? "{}") ?? {});
    } catch {
      /* storage blocked */
    }
  }, []);
  const vote = (id: number) => {
    if (voted[id]) return;
    const next = { ...voted, [id]: true };
    setVoted(next);
    try {
      localStorage.setItem("smp_helpful", JSON.stringify(next));
    } catch {
      /* fine */
    }
    void markReviewHelpfulAction({ id });
  };
  const [shown, setShown] = useState(PAGE);
  const [photo, setPhoto] = useState<string | null>(null);

  const withPhotos = reviews.filter((r) => r.photos.length).length;
  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: reviews.length },
    ...(withPhotos ? [{ id: "photos" as const, label: "With photos", n: withPhotos }] : []),
    ...([5, 4, 3, 2, 1] as const)
      .map((s) => ({ id: s, label: `${s}★`, n: reviews.filter((r) => r.rating === s).length }))
      .filter((f) => f.n > 0),
  ];
  const list = reviews
    .filter((r) => (filter === "all" ? true : filter === "photos" ? r.photos.length > 0 : r.rating === filter))
    .sort((a, b) =>
      sort === "helpful" ? b.helpful - a.helpful : sort === "high" ? b.rating - a.rating : sort === "low" ? a.rating - b.rating : b.createdAt.localeCompare(a.createdAt),
    );

  if (!reviews.length)
    return (
      <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-white p-10 text-center">
        <p className="font-semibold text-ink">No reviews yet. Be the first.</p>
        <p className="mt-1 text-sm text-ink-muted">Bought this? Review it from your orders.</p>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Filter reviews" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={String(f.id)}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setShown(PAGE);
              }}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                filter === f.id ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-forest/40",
              )}
            >
              {f.label} <span className="font-normal opacity-70">{f.n}</span>
            </button>
          ))}
        </div>
        <label className="ml-auto text-sm text-ink-muted">
          <span className="sr-only">Sort reviews</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-full border border-line bg-white px-3 text-sm text-ink"
          >
            <option value="recent">Most recent</option>
            <option value="helpful">Most helpful</option>
            <option value="high">Highest rated</option>
            <option value="low">Lowest rated</option>
          </select>
        </label>
      </div>

      <ul className="grid content-start gap-4 md:grid-cols-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {list.slice(0, shown).map((r) => (
            <motion.li
              key={r.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col rounded-3xl border border-line bg-white p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={cn("size-4", i < r.rating ? "fill-co-accent text-co-accent" : "fill-line text-line")} />
                  ))}
                </span>
                <span className="text-xs text-ink-muted">{formatDateTime(r.createdAt, { time: false })}</span>
              </div>
              {r.title && <h3 className="mt-3 text-lg leading-snug text-ink">{r.title}</h3>}
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{r.body}</p>
              {r.photos.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {r.photos.slice(0, 4).map((p) => (
                    <button key={p.url} type="button" onClick={() => setPhoto(p.url)} aria-label="View photo" className="size-16 overflow-hidden rounded-xl bg-sunken">
                      <SmartImage src={p.url} alt="" width={64} height={64} className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => vote(r.id)}
                aria-pressed={!!voted[r.id]}
                className={cn(
                  "mt-3 inline-flex h-9 w-fit items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                  voted[r.id] ? "border-forest/30 bg-co-brand-soft text-forest" : "border-line text-ink-muted hover:text-ink",
                )}
              >
                <ThumbsUp className="size-3.5" /> Helpful ({r.helpful + (voted[r.id] ? 1 : 0)})
              </button>
              {r.reply && <p className="mt-3 rounded-2xl bg-page px-3 py-2 text-sm text-ink-muted">Reply from us: {r.reply}</p>}
              <p className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-sm font-semibold text-ink">
                {formatName(r.name)}
                {r.city && <span className="font-normal text-ink-muted">· {formatName(r.city)}</span>}
                {r.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-co-success/10 px-2 py-0.5 text-xs font-semibold text-co-success">
                    <BadgeCheck className="size-3.5" /> Verified buyer
                  </span>
                )}
              </p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {list.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mx-auto mt-5 flex h-11 items-center rounded-full border border-line bg-white px-6 text-sm font-semibold text-ink hover:border-forest"
        >
          Load more reviews ({list.length - shown})
        </button>
      )}

      <Dialog open={!!photo} onOpenChange={(o) => !o && setPhoto(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-2">
          <DialogTitle className="sr-only">Review photo</DialogTitle>
          {photo && <SmartImage src={photo} alt="Review photo" width={800} height={800} className="h-auto w-full rounded-2xl object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
