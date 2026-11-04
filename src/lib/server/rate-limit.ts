import "server-only";
import { headers } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

/**
 * Fixed-window limiter stored in MySQL (survives restarts, shared across processes).
 * Returns { ok, retryInMin }. Fails open if the DB is unreachable (never blocks checkout on a DB blip).
 */
export async function rateLimit(name: string, key: string, max: number, windowMin: number) {
  const bucket = `${name}:${key}`.slice(0, 120);
  try {
    await db().execute(
      `INSERT INTO rate_limits (bucket, hits, window_ends) VALUES (?, 1, NOW() + INTERVAL ? MINUTE)
       ON DUPLICATE KEY UPDATE
         hits = IF(window_ends < NOW(), 1, hits + 1),
         window_ends = IF(window_ends < NOW(), NOW() + INTERVAL ? MINUTE, window_ends)`,
      [bucket, windowMin, windowMin],
    );
    const [[r]] = await db().query<RowDataPacket[]>("SELECT hits, TIMESTAMPDIFF(SECOND, NOW(), window_ends) AS secs FROM rate_limits WHERE bucket = ?", [bucket]);
    return { ok: r.hits <= max, retryInMin: Math.max(1, Math.ceil(Number(r.secs) / 60)) };
  } catch (e) {
    console.error("rateLimit", e);
    return { ok: true, retryInMin: 0 };
  }
}

export async function resetLimit(name: string, key: string) {
  await db().execute("DELETE FROM rate_limits WHERE bucket = ?", [`${name}:${key}`.slice(0, 120)]).catch(() => {});
}
