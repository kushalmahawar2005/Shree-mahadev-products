import { Suspense } from "react";
import { connection } from "next/server";
import { Container } from "@/components/ui/primitives";
import { VerifiedReviewForm } from "@/components/reviews/VerifiedReviewForm";
import { db } from "@/lib/server/db";
import type { RowDataPacket } from "mysql2/promise";

export const metadata = {
  title: "Write a review",
  robots: { index: false, follow: false },
};

export default function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  return (
    <Container className="max-w-3xl py-10 md:py-16">
      <h1 className="text-4xl md:text-5xl">Share your experience</h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Reviews are available after delivery. We publish genuine feedback after
        a quick moderation check.
      </p>
      <Suspense
        fallback={<p className="mt-8 text-ink-muted">Checking your order…</p>}
      >
        <ReviewData searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function ReviewData({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  await connection();
  const params = await searchParams;
  const token =
    typeof params.t === "string" && /^[a-f0-9]{32}$/.test(params.t)
      ? params.t
      : "";
  if (!token)
    return (
      <p className="mt-8 rounded-2xl bg-khaki-soft p-5 text-ink-muted">
        Open the review link from your delivered order email.
      </p>
    );
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT o.id, o.status, o.customer_name, oi.product_handle, MAX(oi.product_title) AS product_title,
       r.id AS review_id FROM orders o JOIN order_items oi ON oi.order_id=o.id
       LEFT JOIN reviews r ON r.order_id=o.id AND r.product_handle=oi.product_handle
       WHERE o.token=? GROUP BY o.id, o.status, o.customer_name, oi.product_handle, r.id
       ORDER BY MIN(oi.id)`,
    [token],
  );
  if (!rows.length || rows[0].status !== "delivered")
    return (
      <p className="mt-8 rounded-2xl bg-khaki-soft p-5 text-ink-muted">
        This review link is available once your order is marked delivered. If
        your order has arrived, please contact us on WhatsApp.
      </p>
    );
  return (
    <div className="mt-8 space-y-5">
      {rows.map((row) => (
        <section
          key={String(row.product_handle)}
          className="rounded-2xl border border-line p-5 md:p-7"
        >
          <h2 className="text-2xl">{String(row.product_title)}</h2>
          {row.review_id ? (
            <p className="mt-3 rounded-xl bg-khaki-soft p-4 text-forest">
              Your review for this product has already been submitted.
            </p>
          ) : (
            <VerifiedReviewForm
              token={token}
              productHandle={String(row.product_handle)}
            />
          )}
        </section>
      ))}
    </div>
  );
}
