"use server";

import { z } from "zod";
import { db } from "@/lib/server/db";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/** +1 "Helpful" on an approved review. The browser remembers its vote; the IP limit stops spam. */
export async function markReviewHelpfulAction(raw: unknown) {
  const p = z.object({ id: z.number().int().positive() }).strict().safeParse(raw);
  if (!p.success) return { ok: false as const };
  const limit = await rateLimit("review_helpful", await clientIp(), 30, 60);
  if (!limit.ok) return { ok: false as const };
  await db().query("UPDATE reviews SET helpful = helpful + 1 WHERE id=? AND status='approved'", [p.data.id]);
  return { ok: true as const };
}
