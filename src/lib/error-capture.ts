// Error capture used by instrumentation.ts (onRequestError) and the browser-error action.
// Deliberately free of `server-only` and app imports: instrumentation runs outside the React server
// graph, and monitoring must never itself crash a request. Shares the app's MySQL pool (same global key).
import { createHash } from "node:crypto";
import mysql, { type Pool, type ResultSetHeader } from "mysql2/promise";

export type ErrorInput = {
  source: "server" | "client";
  message: string;
  stack?: string | null;
  digest?: string | null;
  path?: string | null;
  method?: string | null;
  route?: string | null;
  routeType?: string | null;
};

const g = globalThis as unknown as { __smpPool?: Pool; __smpErrAlerts?: number[] };

function pool(): Pool | null {
  if (!process.env.DATABASE_NAME) return null;
  if (!g.__smpPool) {
    g.__smpPool = mysql.createPool({
      host: process.env.DATABASE_HOST ?? "127.0.0.1",
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      connectionLimit: 5,
      timezone: "+05:30",
      dateStrings: true,
    });
    g.__smpPool.pool.on("connection", (conn) => {
      conn.query("SET time_zone = '+05:30'");
    });
  }
  return g.__smpPool;
}

/** Expected control-flow "errors" (redirect, notFound, auth checks) are not bugs. */
const IGNORE = [/^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR)/, /^Unauthorized/i, /^Session expired/i, /^You do not have permission/i, /dynamic server usage/i];

/** Drop the query string (it can hold order tokens) and cap the length. */
const cleanPath = (p?: string | null) => (p ? p.split("?")[0]!.slice(0, 300) : null);

/** Numbers, ids and hashes vary between occurrences of the same bug: blank them for grouping. */
const normalise = (m: string) =>
  m
    .split("\n")[0]!
    .replace(/[0-9a-f]{16,}/gi, "#")
    .replace(/\d+/g, "#")
    .slice(0, 300);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Never throws. A new kind of error emails STORE_ALERT_EMAIL (at most 10 alerts an hour per server). */
export async function recordError(e: ErrorInput) {
  try {
    const db = pool();
    if (!db) return;
    const message = (e.message || "Unknown error").slice(0, 1000);
    if (IGNORE.some((r) => r.test(message)) || (e.digest && /^NEXT_/.test(e.digest))) return;
    const route = e.route?.slice(0, 300) ?? null;
    const fingerprint = createHash("sha1").update(`${e.source}|${route ?? cleanPath(e.path) ?? ""}|${normalise(message)}`).digest("hex");
    const [res] = await db.execute<ResultSetHeader>(
      `INSERT INTO error_log (fingerprint, source, route_type, route, path, method, message, stack, digest)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE count = count + 1, last_at = NOW(), path = VALUES(path), digest = VALUES(digest),
         stack = COALESCE(VALUES(stack), stack), resolved = 0`,
      [
        fingerprint,
        e.source,
        e.routeType?.slice(0, 20) ?? null,
        route,
        cleanPath(e.path),
        e.method?.slice(0, 10) ?? null,
        message,
        e.stack ? e.stack.slice(0, 8000) : null,
        e.digest?.slice(0, 64) ?? null,
      ],
    );
    // affectedRows: 1 = first time this error is seen, 2 = it happened again.
    if (res.affectedRows === 1) await alert(db, fingerprint, e, message, route);
  } catch (err) {
    console.error("recordError failed", err);
  }
}

async function alert(db: Pool, fingerprint: string, e: ErrorInput, message: string, route: string | null) {
  const to = process.env.STORE_ALERT_EMAIL;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
  const now = Date.now();
  g.__smpErrAlerts = (g.__smpErrAlerts ?? []).filter((t) => now - t < 3_600_000);
  if (g.__smpErrAlerts.length >= 10) return;
  g.__smpErrAlerts.push(now);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://swadeshimahadevproducts.in").replace(/\/$/, "");
  const where = route ?? cleanPath(e.path) ?? "unknown";
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#17251d">
<h2 style="margin:0 0 8px">New ${e.source} error on the website</h2>
<p><b>${esc(message)}</b></p>
<p style="color:#667">Where: ${esc(where)} ${e.method ? `(${esc(e.method)})` : ""}</p>
<p><a href="${esc(base)}/admin/errors">Open the error list</a></p></div>`;
  // Sent by the email-outbox cron (every 10 minutes).
  await db.execute(
    `INSERT IGNORE INTO email_outbox (order_id, template, to_email, subject, html, text_body, dedupe_key)
     VALUES (NULL, 'store_error_alert', ?, ?, ?, ?, ?)`,
    [to, `Website error: ${message.slice(0, 120)}`, html, `${message}\nWhere: ${where}\n${base}/admin/errors`, `error:${fingerprint}`],
  );
}
