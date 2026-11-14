"use client";

import { useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { CheckCircle2 } from "@/components/icons/duo";
import { ReviewPhotoPicker, uploadReviewPhotos, type PickedPhoto } from "./ReviewPhotos";
import { Chips, SUGGEST, type Cat } from "@/components/reviews/WriteReview";
import { cn } from "@/lib/utils/cn";
import {
  signReviewUploadAction,
  submitVerifiedReviewAction,
} from "@/lib/review-actions";


const field =
  "w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10";
const LABELS = ["", "Poor", "Okay", "Good", "Very good", "Loved it"];

export function VerifiedReviewForm({
  token,
  productHandle,
  category = "oil",
}: {
  token: string;
  productHandle: string;
  category?: string;
}) {
  const [hover, setHover] = useState(0);
  const [files, setFiles] = useState<PickedPhoto[]>([]);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    startTransition(async () => {
      try {
        const photos = await uploadReviewPhotos(files.map((f) => f.file), () => signReviewUploadAction({ token, productHandle }));
        const result = await submitVerifiedReviewAction({
          token,
          productHandle,
          rating,
          title,
          body,
          photos,
        });
        if (!result.ok) {
          setNotice(result.error ?? "Could not submit your review.");
          return;
        }
        setNotice(
          result.message ??
            "Thanks. Your review has been submitted for approval.",
        );
        setDone(true);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not upload your photos.",
        );
      }
    });
  }

  const shown = hover || rating;
  const pool = SUGGEST[(category in SUGGEST ? category : "oil") as Cat][rating >= 4 ? "good" : rating === 3 ? "mid" : "low"];

  if (done)
    return (
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-forest/5 p-4 text-forest">
        <CheckCircle2 className="size-6 shrink-0" />
        <p className="text-sm font-semibold">{notice || "Thanks. Your review has been submitted for approval."}</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-5 space-y-5">
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Your rating</p>
        <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
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
              <Star className={cn("size-9", n <= shown ? "fill-[#f5b400] text-[#f5b400]" : "fill-line text-line")} />
            </button>
          ))}
          <span className="ml-2 text-sm font-semibold text-forest-text">{LABELS[shown]}</span>
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Headline (optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Asli kachi ghani swad" className={cn(field, "h-12")} />
        <Chips items={pool.title} active={(t) => t === title} onPick={setTitle} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Your review</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={10}
          maxLength={3000}
          required
          rows={5}
          className={cn(field, "py-3 leading-relaxed")}
          placeholder="Taste, smell, packing, how you used it…"
        />
        <Chips items={pool.body} active={(t) => body.includes(t)} onPick={(t) => setBody((b) => (b.includes(t) ? b : `${b.trim()} ${t}`.trim()))} plus />
      </label>
      <ReviewPhotoPicker files={files} onChange={setFiles} />
      {notice && (
        <p role="alert" className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
          {notice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn-shine inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-forest-mid disabled:opacity-60 sm:w-auto"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Submitting…" : "Submit review"}
      </button>
      <p className="text-xs text-ink-muted">Linked to your delivered order and shown as a verified review after a quick check.</p>
    </form>
  );
}
