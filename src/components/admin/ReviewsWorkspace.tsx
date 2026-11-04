"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  featureReviewAction,
  importGoogleReviewAction,
  moderateReviewAction,
  updateReviewReplyAction,
} from "@/lib/review-actions";
import type { PublicReview } from "@/lib/server/reviews";
import { Card, inputCls } from "@/components/admin/ui";

type Product = { handle: string; title: string };

export function ReviewsWorkspace({
  pending,
  approved,
  rejected,
  products,
}: {
  pending: PublicReview[];
  approved: PublicReview[];
  rejected: PublicReview[];
  products: Product[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">(
    "pending",
  );
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, startTransition] = useTransition();
  const lists = { pending, approved, rejected };

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setNotice("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setNotice(result.error ?? "Could not save this change.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Review status"
          >
            {(["pending", "approved", "rejected"] as const).map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={tab === status}
                onClick={() => setTab(status)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${tab === status ? "border-forest bg-forest text-white" : "border-line"}`}
              >
                {status === "pending"
                  ? "Pending"
                  : status === "approved"
                    ? "Published"
                    : "Hidden"}{" "}
                <span className="ml-1 opacity-75">{lists[status].length}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowImport((value) => !value)}
            className="min-h-11 rounded-full border border-line px-5 font-semibold"
          >
            {showImport ? "Close import" : "Import a Google review"}
          </button>
        </div>
        {notice && (
          <p role="alert" className="mt-4 text-sm text-sale">
            {notice}
          </p>
        )}
      </Card>
      {showImport && (
        <Card title="Import a real Google review">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              run(async () => {
                const result = await importGoogleReviewAction({
                  productHandle: String(form.get("productHandle")),
                  name: String(form.get("name")),
                  city: String(form.get("city")),
                  rating: Number(form.get("rating")),
                  title: String(form.get("title")),
                  body: String(form.get("body")),
                  createdAt: String(form.get("createdAt")),
                });
                if (result.ok) {
                  setShowImport(false);
                  setTab("pending");
                }
                return result;
              });
            }}
          >
            <label>
              <span className="mb-1 block text-sm font-semibold">Product</span>
              <select name="productHandle" required className={inputCls}>
                <option value="">Choose product</option>
                {products.map((p) => (
                  <option key={p.handle} value={p.handle}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Name shown on Google
              </span>
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                className={inputCls}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">
                City (optional)
              </span>
              <input name="city" maxLength={80} className={inputCls} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">Rating</span>
              <select name="rating" className={inputCls}>
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} stars
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Review date
              </span>
              <input
                name="createdAt"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
                className={inputCls}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Title (optional)
              </span>
              <input name="title" maxLength={160} className={inputCls} />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-semibold">
                Review text
              </span>
              <textarea
                name="body"
                required
                minLength={10}
                maxLength={3000}
                rows={4}
                className="w-full rounded-2xl border border-line p-4"
              />
            </label>
            <p className="text-sm text-ink-muted md:col-span-2">
              Imported reviews enter Pending and still need approval before
              publishing.
            </p>
            <button
              disabled={busy}
              className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white"
            >
              Import review
            </button>
          </form>
        </Card>
      )}
      <div className="space-y-4">
        {lists[tab].length ? (
          lists[tab].map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              status={tab}
              busy={busy}
              run={run}
            />
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">
              No {tab === "approved" ? "published" : tab} reviews.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  status,
  busy,
  run,
}: {
  review: PublicReview;
  status: "pending" | "approved" | "rejected";
  busy: boolean;
  run: (action: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [reply, setReply] = useState(review.reply);
  const photos = review.photos;
  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-forest-text">
              {review.title || review.productTitle}
            </h2>
            <span className="rounded-full bg-khaki-soft px-3 py-1 text-xs font-semibold text-forest">
              {review.verified
                ? "Verified buyer"
                : review.source === "google"
                  ? "Google review"
                  : "Site review"}
            </span>
            <span
              aria-label={`${review.rating} out of 5 stars`}
              className="text-mustard"
            >
              {"★".repeat(review.rating)}
              <span className="text-ink-muted/30">
                {"★".repeat(5 - review.rating)}
              </span>
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {review.name}
            {review.city ? ` · ${review.city}` : ""} · {review.productTitle} ·{" "}
            {review.createdAt.slice(0, 10)}
          </p>
          <p className="mt-4 whitespace-pre-wrap leading-relaxed">
            {review.body}
          </p>
          {review.holdReason && (
            <p className="mt-3 rounded-xl bg-khaki-soft p-3 text-sm text-sale">
              Auto-held: {review.holdReason}
            </p>
          )}
          {photos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {photos.map((photo) => (
                <a
                  key={photo.publicId}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative size-20 overflow-hidden rounded-xl"
                >
                  <Image
                    src={photo.url}
                    alt={`Photo attached to ${review.name}'s review`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          {status === "approved" && (
            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                run(() => updateReviewReplyAction({ id: review.id, reply }));
              }}
            >
              <label className="sr-only" htmlFor={`reply-${review.id}`}>
                Public reply
              </label>
              <input
                id={`reply-${review.id}`}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                maxLength={2000}
                placeholder="Add a public reply"
                className={inputCls}
              />
              <button
                disabled={busy}
                className="min-h-11 shrink-0 rounded-full border border-forest px-5 font-semibold text-forest"
              >
                Save reply
              </button>
            </form>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2 lg:max-w-52 lg:flex-col">
          {status === "pending" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    moderateReviewAction({ id: review.id, action: "approve" }),
                  )
                }
                className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white"
              >
                Publish
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    moderateReviewAction({ id: review.id, action: "hide" }),
                  )
                }
                className="min-h-11 rounded-full border border-line px-5 font-semibold"
              >
                Hide
              </button>
            </>
          )}
          {status === "approved" && (
            <>
              <label className="flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={review.featured}
                  disabled={busy}
                  onChange={(event) =>
                    run(() =>
                      featureReviewAction({
                        id: review.id,
                        featured: event.target.checked,
                      }),
                    )
                  }
                  className="size-4 accent-forest"
                />
                Homepage feature
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    moderateReviewAction({ id: review.id, action: "hide" }),
                  )
                }
                className="min-h-11 rounded-full border border-line px-5 font-semibold"
              >
                Hide
              </button>
            </>
          )}
          {status === "rejected" && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  moderateReviewAction({ id: review.id, action: "approve" }),
                )
              }
              className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white"
            >
              Publish
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
