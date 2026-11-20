import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { refreshTrackingByAwb } from "@/lib/server/shipments";

/**
 * Velocity webhooks (events: Status Change, Tracking Addition). Register in Velocity → Settings →
 * Webhooks with URL https://<site>/api/velocity/webhook and a secret token; put the same token in
 * VELOCITY_WEBHOOK_TOKEN. The token is accepted from `Authorization: Bearer …`, a plain
 * `Authorization` / `x-api-key` / `x-webhook-token` header, or `?token=` on the URL.
 *
 * The body is never trusted: we only take the AWB from it and ask Velocity's tracking API for the real
 * status (same rule as payments). So whatever shape Velocity sends, the shipment ends up correct, and
 * a forged call can at most trigger one refresh of a shipment we already have.
 */
function tokenOk(req: NextRequest) {
  const secret = process.env.VELOCITY_WEBHOOK_TOKEN;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const candidates = [
    auth.replace(/^(Bearer|Token|Basic)\s+/i, ""),
    req.headers.get("x-api-key"),
    req.headers.get("x-webhook-token"),
    req.headers.get("x-auth-token"),
    req.nextUrl.searchParams.get("token"),
  ];
  // Basic auth: accept "user:token" where either part is the token.
  if (/^Basic\s+/i.test(auth)) {
    try {
      candidates.push(...Buffer.from(auth.replace(/^Basic\s+/i, ""), "base64").toString("utf8").split(":"));
    } catch {}
  }
  const want = Buffer.from(secret);
  return candidates.some((c) => {
    if (!c) return false;
    const got = Buffer.from(c.trim());
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

const AWB_KEYS = ["awb", "awb_code", "awb_number", "awbNumber", "awbs", "tracking_number", "trackingNumber", "waybill"];

/** First AWB-looking value anywhere in the payload (Velocity nests it under data / shipment / result). */
function findAwb(v: unknown, depth = 0): string | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const f = findAwb(x, depth + 1);
      if (f) return f;
    }
    return null;
  }
  const o = v as Record<string, unknown>;
  for (const k of AWB_KEYS) {
    const x = o[k];
    if ((typeof x === "string" || typeof x === "number") && /^[A-Za-z0-9-]{6,40}$/.test(String(x))) return String(x);
    if (Array.isArray(x) && x.length && /^[A-Za-z0-9-]{6,40}$/.test(String(x[0]))) return String(x[0]);
  }
  for (const x of Object.values(o)) {
    const f = findAwb(x, depth + 1);
    if (f) return f;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const limit = await rateLimit("velocity_webhook", await clientIp(), 300, 5);
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const raw = await req.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignored: "not json" });
  }
  const awb = findAwb(body);
  const event = typeof body === "object" && body ? String((body as Record<string, unknown>).event ?? (body as Record<string, unknown>).type ?? "") : "";
  await db()
    .execute("INSERT INTO webhook_logs (source, event, ref, payload) VALUES ('velocity', ?, ?, ?)", [event.slice(0, 60) || null, awb, raw])
    .catch((e) => console.error("velocity webhook log failed", e));
  if (!awb) return NextResponse.json({ ok: true, ignored: "no awb" });

  // Always answer 200 quickly (Velocity waits 10 s, retries 3 times); a failed refresh is retried by the cron.
  try {
    const known = await refreshTrackingByAwb(awb);
    return NextResponse.json({ ok: true, refreshed: known });
  } catch (e) {
    console.error("velocity webhook refresh", awb, e);
    return NextResponse.json({ ok: true, refreshed: false });
  }
}
