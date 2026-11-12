import { cutoutUrl } from "@/lib/image-loader";
import { Suspense } from "react";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock, MessageCircle, PenLine } from "@/components/icons/duo";
import { getProducts } from "@/lib/commerce";
import { whatsappLink } from "@/data/site";
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
    <div className="bg-page">
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-10 md:pt-12 md:pb-24">
        <p className="font-hindi text-lg text-sale" lang="hi">
          आपकी राय
        </p>
        <h1 className="text-3xl md:text-5xl">How was your order?</h1>
        <p className="mt-3 max-w-2xl text-ink-muted md:text-lg">
          Your honest review helps other families choose. It takes a minute.
        </p>
        <Suspense
          fallback={
            <div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/60" />
          }
        >
          <ReviewData searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Clock;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-8 flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-12 text-center">
      <span className="shrink-0 text-forest">
        <Icon className="size-10" />
      </span>
      <p className="mt-4 text-lg font-bold text-forest-text">{title}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{text}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/shop"
          className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold text-forest-text hover:border-forest/40"
        >
          Browse products
        </Link>
        <a
          href={whatsappLink("Hi, I'd like to review my order.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-forest-mid"
        >
          <MessageCircle className="size-4" /> WhatsApp us
        </a>
      </div>
    </div>
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
      <Notice
        icon={PenLine}
        title="Open your review link"
        text="Use the review link from your delivery email or WhatsApp message. You can also review any product from its page."
      />
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
      <Notice
        icon={Clock}
        title="Not delivered yet"
        text="This link opens once your order is marked delivered. If it has already arrived, message us and we'll sort it out."
      />
    );
  const catalog = await getProducts();
  const info = (handle: string) => catalog.find((p) => p.handle === handle);
  return (
    <div className="mt-8 space-y-5">
      {rows.length > 1 && (
        <p className="text-sm text-ink-muted">
          {rows.length} products in this order. Review as many as you like.
        </p>
      )}
      {rows.map((row) => {
        const p = info(String(row.product_handle));
        const img = p?.images[0];
        return (
          <section
            key={String(row.product_handle)}
            className="rounded-3xl border border-line bg-white p-5 md:p-7"
          >
            <div className="flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[radial-gradient(circle_at_50%_60%,#f3e6c8,#f6efe2_70%)]">
                {img && (
                  <Image src={cutoutUrl(img.url)} alt="" width={48} height={48} className="size-12 object-contain" />
                )}
              </span>
              <h2 className="text-xl md:text-2xl">
                {String(row.product_title).replace(
                  /^(Wood|Cold)-Pressed\s+/,
                  "",
                )}
              </h2>
            </div>
            {row.review_id ? (
              <p className="mt-5 flex items-center gap-2 rounded-2xl bg-forest/5 p-4 text-sm font-semibold text-forest">
                <CheckCircle2 className="size-5" /> Thanks, you&apos;ve already
                reviewed this product.
              </p>
            ) : (
              <VerifiedReviewForm
                token={token}
                productHandle={String(row.product_handle)}
                category={p?.category}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
