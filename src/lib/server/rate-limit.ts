import "server-only";
import { headers } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

/**
 * The visitor's IP as seen by OUR proxy. The left-most X-Forwarded-For entry is whatever the client
 * sent (spoofable); each proxy in front of the app appends the address it received from, so the
 * trustworthy entry is the one added by the outermost proxy we control: `TRUSTED_PROXY_HOPS` from the
 * right (default 1 = the hosting proxy directly in front of Node).
 */
export async function clientIp() {
  const h = await headers();
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain[chain.length - hops] || chain[0] || h.get("x-real-ip") || "local";
}

/** Per-process fallback used only while MySQL is unreachable, so limits never silently switch off. */
const memory = new Map<string, { hits: number; ends: number }>();
function memoryLimit(bucket: string, max: number, windowMin: number) {
  const now = Date.now();
  if (memory.size > 5000) for (const [k, v] of memory) if (v.ends < now) memory.delete(k);
  const cur = memory.get(bucket);
  const entry = !cur || cur.ends < now ? { hits: 1, ends: now + windowMin * 60_000 } : { hits: cur.hits + 1, ends: cur.ends };
  memory.set(bucket, entry);
  return { ok: entry.hits <= max, retryInMin: Math.max(1, Math.ceil((entry.ends - now) / 60_000)) };
}

/**
 * Fixed-window limiter stored in MySQL (survives restarts, shared across processes).
 * Returns { ok, retryInMin }. If the DB is unreachable it falls back to an in-memory counter per process
 * (still limits OTP / chat / login abuse, and never blocks a normal shopper on a DB blip).
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
    console.error("rateLimit (using in-memory fallback)", e);
    return memoryLimit(bucket, max, windowMin);
  }
}

export async function resetLimit(name: string, key: string) {
  await db().execute("DELETE FROM rate_limits WHERE bucket = ?", [`${name}:${key}`.slice(0, 120)]).catch(() => {});
}
