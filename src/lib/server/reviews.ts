import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";

export type ReviewPhoto = { url: string; publicId: string };
export type PublicReview = {
  id: number;
  productHandle: string;
  productTitle: string;
  name: string;
  city: string;
  rating: number;
  title: string;
  body: string;
  reply: string;
  source: string;
  createdAt: string;
  photos: ReviewPhoto[];
  verified: boolean;
  featured: boolean;
  holdReason: string;
  helpful: number;
};

async function mapPhotos(rows: RowDataPacket[]) {
  const ids = rows.map((r) => Number(r.id));
  const [photos] = ids.length
    ? await db().query<RowDataPacket[]>(
        "SELECT review_id, url, public_id FROM review_photos WHERE review_id IN (?) ORDER BY id",
        [ids],
      )
    : [[] as RowDataPacket[]];
  const byId = new Map<number, ReviewPhoto[]>();
  for (const photo of photos) {
    const id = Number(photo.review_id);
    const list = byId.get(id) ?? [];
    list.push({ url: String(photo.url), publicId: String(photo.public_id) });
    byId.set(id, list);
  }
  return rows.map(
    (row) =>
      ({
        id: Number(row.id),
        productHandle: String(row.product_handle),
        productTitle: String(row.product_title ?? ""),
        name: String(row.name),
        city: String(row.city ?? ""),
        rating: Number(row.rating),
        title: String(row.title ?? ""),
        body: String(row.body),
        reply: String(row.reply ?? ""),
        source: String(row.source),
        createdAt: String(row.created_at),
        photos: byId.get(Number(row.id)) ?? [],
        verified: row.order_id !== null && row.order_id !== undefined,
        featured: Boolean(row.featured),
        holdReason: String(row.auto_hold_reason ?? ""),
        helpful: Number(row.helpful ?? 0),
      }) satisfies PublicReview,
  );
}

export async function getProductReviews(
  handle: string,
): Promise<PublicReview[]> {
  "use cache";
  cacheLife({ revalidate: 3600 });
  cacheTag("reviews", `reviews:${handle}`);
  // No database (e.g. a preview deploy): no reviews yet, same as store-settings falls back to defaults.
  if (!process.env.DATABASE_NAME) return [];
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT r.id, r.product_handle, r.order_id, r.featured, r.helpful, r.auto_hold_reason, p.title AS product_title, r.name, r.city, r.rating, r.title, r.body, r.reply, r.source, r.created_at
     FROM reviews r JOIN products p ON p.handle=r.product_handle WHERE r.status='approved' AND r.product_handle=?
     ORDER BY r.created_at DESC LIMIT 30`,
    [handle],
  );
  return mapPhotos(rows);
}

export async function getFeaturedReviews(): Promise<PublicReview[]> {
  "use cache";
  cacheLife({ revalidate: 3600 });
  cacheTag("reviews", "reviews:featured");
  if (!process.env.DATABASE_NAME) return [];
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT r.id, r.product_handle, r.order_id, r.featured, r.helpful, r.auto_hold_reason, p.title AS product_title, r.name, r.city, r.rating, r.title, r.body, r.reply, r.source, r.created_at
     FROM reviews r JOIN products p ON p.handle=r.product_handle WHERE r.status='approved' AND r.featured=1
     ORDER BY r.created_at DESC LIMIT 6`,
  );
  return mapPhotos(rows);
}

/** Best approved 4-5★ reviews from other products (featured first), for a product that has none yet. */
export async function getOtherProductReviews(excludeHandle: string, limit = 3): Promise<PublicReview[]> {
  "use cache";
  cacheLife({ revalidate: 3600 });
  cacheTag("reviews");
  if (!process.env.DATABASE_NAME) return [];
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT r.id, r.product_handle, r.order_id, r.featured, r.helpful, r.auto_hold_reason, p.title AS product_title, r.name, r.city, r.rating, r.title, r.body, r.reply, r.source, r.created_at
     FROM reviews r JOIN products p ON p.handle=r.product_handle
     WHERE r.status='approved' AND r.rating>=4 AND r.product_handle<>?
     ORDER BY r.featured DESC, r.created_at DESC LIMIT ?`,
    [excludeHandle, limit],
  );
  return mapPhotos(rows);
}

export async function listAdminReviews(
  status: "pending" | "approved" | "rejected",
) {
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT r.*, p.title AS product_title FROM reviews r LEFT JOIN products p ON p.handle=r.product_handle
     WHERE r.status=? ORDER BY r.created_at DESC LIMIT 300`,
    [status],
  );
  return mapPhotos(rows);
}
