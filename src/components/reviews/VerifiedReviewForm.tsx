"use client";

import { useState, useTransition } from "react";
import {
  signReviewUploadAction,
  submitVerifiedReviewAction,
} from "@/lib/review-actions";

type Uploaded = { url: string; publicId: string };

export function VerifiedReviewForm({
  token,
  productHandle,
}: {
  token: string;
  productHandle: string;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  async function uploadPhotos(files: File[]): Promise<Uploaded[]> {
    if (!files.length) return [];
    if (
      files.length > 3 ||
      files.some((file) => !file.type.startsWith("image/"))
    )
      throw new Error("Choose up to 3 image files.");
    const signature = await signReviewUploadAction({ token, productHandle });
    if (!signature.ok) throw new Error(signature.error);
    const output: Uploaded[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signature.apiKey);
      form.append("timestamp", String(signature.timestamp));
      form.append("folder", signature.folder);
      form.append("allowed_formats", signature.allowed_formats);
      form.append("signature", signature.signature);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        { method: "POST", body: form },
      );
      if (!response.ok)
        throw new Error(
          "A photo couldn't be uploaded. Please remove it and try again.",
        );
      const image = await response.json();
      output.push({ url: image.secure_url, publicId: image.public_id });
    }
    return output;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const form = event.currentTarget;
    const files = Array.from(
      (form.elements.namedItem("photos") as HTMLInputElement).files ?? [],
    );
    startTransition(async () => {
      try {
        const photos = await uploadPhotos(files);
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

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-forest-text">
          Your rating
        </legend>
        <div role="radiogroup" aria-label="Your rating" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-line px-2 has-[:checked]:border-forest has-[:checked]:bg-khaki-soft"
            >
              <input
                type="radio"
                name={`rating-${productHandle}`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
              />
              <span
                aria-hidden
                className={
                  value <= rating ? "text-mustard" : "text-ink-muted/30"
                }
              >
                ★
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-forest-text">
          Short title (optional)
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          className="min-h-12 w-full rounded-2xl border border-line px-4"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-forest-text">
          Your review
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={10}
          maxLength={3000}
          required
          rows={5}
          className="w-full rounded-2xl border border-line p-4"
          placeholder="What did you think of the product?"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-forest-text">
          Photos (optional, up to 3)
        </span>
        <input
          type="file"
          name="photos"
          accept="image/*"
          multiple
          className="block min-h-11 w-full rounded-xl border border-line p-2 text-sm file:mr-3 file:min-h-9 file:rounded-full file:border-0 file:bg-khaki-soft file:px-3"
        />
      </label>
      <p className="text-sm text-ink-muted">
        Your review is linked to your delivered order and will appear after
        moderation.
      </p>
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl bg-khaki-soft p-3 text-sm text-forest"
        >
          {notice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || done}
        className="min-h-12 rounded-full bg-forest px-6 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : done ? "Review submitted" : "Submit review"}
      </button>
    </form>
  );
}
