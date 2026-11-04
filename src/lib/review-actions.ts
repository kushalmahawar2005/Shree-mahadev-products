"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { db } from "@/lib/server/db";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import {
  cloudinaryConfigured,
  isOwnCloudinaryUrl,
  signUpload,
} from "@/lib/server/cloudinary";
import { TAGS } from "@/lib/commerce";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

const imageSchema = z
  .object({
    url: z.string().url().max(500),
    publicId: z.string().min(1).max(200),
  })
  .strict();
const verifiedInput = z
  .object({
    token: z.string().regex(/^[a-f0-9]{32}$/),
    productHandle: z.string().regex(/^[a-z0-9-]{2,80}$/),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(160),
    body: z.string().trim().min(10).max(3000),
    photos: z.array(imageSchema).max(3),
  })
  .strict();

async function validDeliveredProduct(
  token: string,
  handle: string,
  conn: Pool | PoolConnection = db(),
) {
  const [orders] = await conn.execute<RowDataPacket[]>(
    `SELECT id, customer_name, city FROM orders WHERE token=? AND status='delivered' LIMIT 1`,
    [token],
  );
  if (!orders[0]) return null;
  const [items] = await conn.execute<RowDataPacket[]>(
    "SELECT DISTINCT product_handle FROM order_items WHERE order_id=? AND product_handle=?",
    [orders[0].id, handle],
  );
  return items.length
    ? {
        id: Number(orders[0].id),
        name: String(orders[0].customer_name),
        city: String(orders[0].city ?? ""),
      }
    : null;
}

export async function signReviewUploadAction(raw: unknown) {
  const limit = await rateLimit("review_upload", await clientIp(), 10, 60);
  if (!limit.ok)
    return {
      ok: false as const,
      error: `Too many uploads. Try again in ${limit.retryInMin} min.`,
    };
  const p = z
    .object({
      token: z.string().regex(/^[a-f0-9]{32}$/),
      productHandle: z.string().regex(/^[a-z0-9-]{2,80}$/),
    })
    .strict()
    .safeParse(raw);
  if (!p.success)
    return { ok: false as const, error: "Invalid review upload." };
  if (!cloudinaryConfigured())
    return {
      ok: false as const,
      error:
        "Photo uploads are not configured yet. You can still send a text review.",
    };
  if (!(await validDeliveredProduct(p.data.token, p.data.productHandle)))
    return {
      ok: false as const,
      error: "Photos can only be added to a review for a delivered order.",
    };
  try {
    return { ok: true as const, ...signUpload("reviews") };
  } catch (error) {
    console.error("Review upload signature failed", error);
    return { ok: false as const, error: "Could not prepare photo upload." };
  }
}

const holdReason = (body: string) => {
  if (/https?:\/\/|www\./i.test(body)) return "Contains a link";
  const words = body.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const stop = new Set([
    "that",
    "with",
    "this",
    "from",
    "have",
    "were",
    "they",
    "them",
    "your",
    "very",
    "good",
    "product",
    "would",
    "after",
    "about",
    "when",
    "which",
  ]);
  const counts = new Map<string, number>();
  for (const word of words)
    if (!stop.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.values()].some((n) => n >= 4) ? "Repeated keyword" : null;
};

export async function submitVerifiedReviewAction(raw: unknown) {
  const limit = await rateLimit("review", await clientIp(), 5, 60);
  if (!limit.ok)
    return {
      ok: false,
      error: `Too many review attempts. Try again in ${limit.retryInMin} min.`,
    };
  const p = verifiedInput.safeParse(raw);
  if (!p.success)
    return {
      ok: false,
      error: p.error.issues[0]?.message ?? "Check your review details.",
    };
  const input = p.data;
  for (const image of input.photos) {
    if (
      !isOwnCloudinaryUrl(image.url, image.publicId) ||
      !image.publicId.startsWith("swadeshi-mahadev/reviews/")
    )
      return {
        ok: false,
        error: "One of the photos was not uploaded to our image store.",
      };
  }
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const order = await validDeliveredProduct(
      input.token,
      input.productHandle,
      conn,
    );
    if (!order) {
      await conn.rollback();
      return {
        ok: false,
        error: "Reviews are available after an order is delivered.",
      };
    }
    const [existing] = await conn.execute<RowDataPacket[]>(
      "SELECT id FROM reviews WHERE order_id=? AND product_handle=? LIMIT 1",
      [order.id, input.productHandle],
    );
    if (existing.length) {
      await conn.rollback();
      return {
        ok: false,
        error: "You've already reviewed this product from this order.",
      };
    }
    const reason = holdReason(input.body);
    const [result] = await conn.execute<ResultSetHeader>(
      "INSERT INTO reviews (product_handle, order_id, name, city, rating, title, body, status, source, auto_hold_reason) VALUES (?,?,?,?,?,?,?,'pending','site',?)",
      [
        input.productHandle,
        order.id,
        order.name.slice(0, 120),
        order.city.slice(0, 80),
        input.rating,
        input.title || null,
        input.body,
        reason,
      ],
    );
    for (const image of input.photos)
      await conn.execute(
        "INSERT INTO review_photos (review_id, url, public_id) VALUES (?,?,?)",
        [result.insertId, image.url, image.publicId],
      );
    await conn.commit();
    return {
      ok: true,
      held: Boolean(reason),
      message: reason
        ? "Thanks. Your review is with our team for a quick check."
        : "Thanks. Your review has been submitted for approval.",
    };
  } catch (error) {
    await conn.rollback();
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY")
      return {
        ok: false,
        error: "You've already reviewed this product from this order.",
      };
    console.error("Review submission failed", error);
    return {
      ok: false,
      error: "We couldn't save your review. Please try again.",
    };
  } finally {
    conn.release();
  }
}

const adminId = z.number().int().positive();
const adminStatus = z
  .object({ id: adminId, action: z.enum(["approve", "hide"]) })
  .strict();
const invalidation = (handle: string) => {
  updateTag("reviews");
  updateTag("reviews:featured");
  updateTag(`reviews:${handle}`);
  updateTag(TAGS.products);
  updateTag(TAGS.product(handle));
};

export async function moderateReviewAction(raw: unknown) {
  const admin = await requireAdmin();
  const p = adminStatus.safeParse(raw);
  if (!p.success) return { ok: false, error: "Invalid review." };
  const status = p.data.action === "approve" ? "approved" : "rejected";
  const [updated] = await db().execute<ResultSetHeader>(
    "UPDATE reviews SET status=?, featured=IF(?='rejected',0,featured) WHERE id=?",
    [status, status, p.data.id],
  );
  if (!updated.affectedRows) return { ok: false, error: "Review not found." };
  const [[review]] = await db().execute<RowDataPacket[]>(
    "SELECT product_handle FROM reviews WHERE id=?",
    [p.data.id],
  );
  const handle = String(review.product_handle);
  await db().execute(
    "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, ?, ?, ?)",
    [
      admin.username,
      `review.${p.data.action}`,
      `review:${p.data.id}`,
      JSON.stringify({ status }),
    ],
  );
  invalidation(handle);
  return { ok: true };
}

export async function updateReviewReplyAction(raw: unknown) {
  const admin = await requireAdmin();
  const p = z
    .object({ id: adminId, reply: z.string().trim().max(2000) })
    .strict()
    .safeParse(raw);
  if (!p.success) return { ok: false, error: "Reply is too long." };
  const [result] = await db().execute<ResultSetHeader>(
    "UPDATE reviews SET reply=? WHERE id=? AND status='approved'",
    [p.data.reply || null, p.data.id],
  );
  if (!result.affectedRows)
    return {
      ok: false,
      error: "Approve the review before adding a public reply.",
    };
  const [[review]] = await db().execute<RowDataPacket[]>(
    "SELECT product_handle FROM reviews WHERE id=?",
    [p.data.id],
  );
  const handle = String(review.product_handle);
  await db().execute(
    "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'review.reply', ?, ?)",
    [
      admin.username,
      `review:${p.data.id}`,
      JSON.stringify({ hasReply: Boolean(p.data.reply) }),
    ],
  );
  invalidation(handle);
  return { ok: true };
}

export async function featureReviewAction(raw: unknown) {
  const admin = await requireAdmin();
  const p = z
    .object({ id: adminId, featured: z.boolean() })
    .strict()
    .safeParse(raw);
  if (!p.success) return { ok: false, error: "Invalid review." };
  const conn = await db().getConnection();
  let handle = "";
  try {
    await conn.beginTransaction();
    await conn.execute(
      "SELECT id FROM admin_users WHERE username=? FOR UPDATE",
      [admin.username],
    );
    const [[review]] = await conn.execute<RowDataPacket[]>(
      "SELECT id, product_handle, status FROM reviews WHERE id=? FOR UPDATE",
      [p.data.id],
    );
    if (!review || review.status !== "approved") {
      await conn.rollback();
      return { ok: false, error: "Only approved reviews can be featured." };
    }
    handle = String(review.product_handle);
    if (p.data.featured) {
      const [[count]] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM reviews WHERE status='approved' AND featured=1",
      );
      if (Number(count.n) >= 6 && !Number(review.featured)) {
        await conn.rollback();
        return { ok: false, error: "Homepage can show up to 6 reviews." };
      }
    }
    await conn.execute("UPDATE reviews SET featured=? WHERE id=?", [
      p.data.featured ? 1 : 0,
      p.data.id,
    ]);
    await conn.execute(
      "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'review.featured', ?, ?)",
      [
        admin.username,
        `review:${p.data.id}`,
        JSON.stringify({ featured: p.data.featured }),
      ],
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error("featureReviewAction failed", error);
    return { ok: false, error: "Could not update homepage reviews." };
  } finally {
    conn.release();
  }
  invalidation(handle);
  return { ok: true };
}

export async function importGoogleReviewAction(raw: unknown) {
  const admin = await requireAdmin();
  const p = z
    .object({
      productHandle: z.string().regex(/^[a-z0-9-]{2,80}$/),
      name: z.string().trim().min(2).max(120),
      city: z.string().trim().max(80),
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().max(160),
      body: z.string().trim().min(10).max(3000),
      createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict()
    .safeParse(raw);
  if (!p.success)
    return {
      ok: false,
      error: p.error.issues[0]?.message ?? "Check the imported review.",
    };
  const [products] = await db().execute<RowDataPacket[]>(
    "SELECT handle FROM products WHERE handle=? AND status='active'",
    [p.data.productHandle],
  );
  if (!products.length)
    return { ok: false, error: "Choose an active product." };
  const [result] = await db().execute<ResultSetHeader>(
    "INSERT INTO reviews (product_handle, name, city, rating, title, body, status, source, created_at) VALUES (?,?,?,?,?,?,'pending','google',?)",
    [
      p.data.productHandle,
      p.data.name,
      p.data.city || null,
      p.data.rating,
      p.data.title || null,
      p.data.body,
      `${p.data.createdAt} 12:00:00`,
    ],
  );
  await db().execute(
    "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'review.imported', ?, ?)",
    [
      admin.username,
      `review:${result.insertId}`,
      JSON.stringify({ source: "google", productHandle: p.data.productHandle }),
    ],
  );
  return { ok: true };
}
