import Image from "next/image";
import Link from "next/link";
import type { PublicReview } from "@/lib/server/reviews";

export function ReviewList({
  reviews,
  rating,
  count,
}: {
  reviews: PublicReview[];
  rating?: number;
  count?: number;
}) {
  return (
    <section aria-labelledby="reviews-heading" className="space-y-5">
      <div>
        <h2 id="reviews-heading" className="text-3xl">
          Customer reviews
        </h2>
        {count ? (
          <p className="mt-2 text-ink-muted">
            {rating?.toFixed(1)} out of 5 · {count}{" "}
            {count === 1 ? "review" : "reviews"}
          </p>
        ) : (
          <p className="mt-2 text-ink-muted">
            No approved reviews yet. Be the first to share your experience after
            delivery.
          </p>
        )}
      </div>
      {reviews.map((review) => (
        <article key={review.id} className="rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-label={`${review.rating} out of 5 stars`}
              className="text-mustard"
            >
              {"★".repeat(review.rating)}
              <span className="text-ink-muted/30">
                {"★".repeat(5 - review.rating)}
              </span>
            </span>
            {review.verified && (
              <span className="rounded-full bg-khaki-soft px-3 py-1 text-xs font-semibold text-forest">
                Verified buyer
              </span>
            )}
            {review.source === "google" && (
              <span className="rounded-full bg-khaki-soft px-3 py-1 text-xs font-semibold text-forest">
                Google review
              </span>
            )}
          </div>
          {review.title && (
            <h3 className="mt-3 font-semibold text-forest-text">
              {review.title}
            </h3>
          )}
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">
            {review.body}
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            {review.name}
            {review.city ? ` · ${review.city}` : ""} ·{" "}
            {review.createdAt.slice(0, 10)}
          </p>
          {review.photos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {review.photos.map((photo) => (
                <a
                  key={photo.publicId}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative size-20 overflow-hidden rounded-xl"
                >
                  <Image
                    src={photo.url}
                    alt={`Photo shared in ${review.name}'s review`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          {review.reply && (
            <div className="mt-4 rounded-xl bg-khaki-soft p-4">
              <p className="text-sm font-semibold text-forest-text">
                Swadeshi Mahadev Products
              </p>
              <p className="mt-1 text-sm">{review.reply}</p>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

export function FeaturedReviewCards({ reviews }: { reviews: PublicReview[] }) {
  if (!reviews.length) return null;
  return (
    <section className="bg-khaki-soft py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl md:text-4xl">What customers say</h2>
            <p className="mt-2 text-ink-muted">
              Reviews from real buyers and customers.
            </p>
          </div>
          <Link
            href="/shop"
            className="min-h-11 rounded-full border border-forest px-5 py-2.5 font-semibold text-forest"
          >
            Explore the store
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 6).map((review) => (
            <article key={review.id} className="rounded-2xl bg-white p-5">
              <p
                aria-label={`${review.rating} out of 5 stars`}
                className="text-mustard"
              >
                {"★".repeat(review.rating)}
                <span className="text-ink-muted/30">
                  {"★".repeat(5 - review.rating)}
                </span>
              </p>
              <h3 className="mt-3 text-xl font-semibold text-forest-text">
                {review.title || review.productTitle}
              </h3>
              <p className="mt-2 line-clamp-4 leading-relaxed">{review.body}</p>
              <p className="mt-4 text-sm text-ink-muted">
                {review.name}
                {review.city ? ` · ${review.city}` : ""} · {review.productTitle}
              </p>
              <Link
                href={`/products/${review.productHandle}#reviews-heading`}
                className="mt-3 inline-block min-h-11 py-2 text-sm font-semibold text-forest underline underline-offset-4"
              >
                View product reviews
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
