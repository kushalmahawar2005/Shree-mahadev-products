import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { applyTrackingUpdate } from "@/lib/server/shipments";

/**
 * NimbusPost v2 webhooks (events: tracking.updated, order.updated, order.created).
 * Register in NimbusPost → Settings → Webhooks with URL https://<site>/api/nimbuspost/webhook
 * and put the subscription's signing secret in NIMBUSPOST_WEBHOOK_SECRET.
 * Signature: x-nimbus-signature = "sha256=" + HMAC-SHA256(raw body, secret).
 * Deliveries can repeat: x-nimbus-delivery is stored and duplicates are skipped.
 */
function validSignature(raw: string, header: string | null) {
  const secret = process.env.NIMBUSPOST_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

const str = (o: Record<string, unknown> | undefined, ...keys: string[]) => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-nimbus-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const event = req.headers.get("x-nimbus-event") ?? str(body, "event", "type");
  const deliveryId = req.headers.get("x-nimbus-delivery");
  const data = (typeof body.data === "object" && body.data ? body.data : body) as Record<string, unknown>;
  const latest = (data.latest ?? {}) as Record<string, unknown>;
  const awb = str(data, "awb", "awb_number", "awbNumber");

  // Log first; a duplicate delivery id means we already processed this event.
  try {
    await db().execute(
      "INSERT INTO webhook_logs (source, event, ref, delivery_id, payload) VALUES ('nimbuspost', ?, ?, ?, ?)",
      [event || null, awb || null, deliveryId, raw],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") return NextResponse.json({ ok: true, duplicate: true });
    console.error("webhook log failed", e);
  }

  const status = str(data, "orderStatus", "order_status", "status", "shipStatus") || str(latest, "shipStatus", "status");
  if (!awb || !status) return NextResponse.json({ ok: true, ignored: true });

  const scans = Array.isArray(data.scans) ? (data.scans as Record<string, unknown>[]) : [];
  const events = scans.map((s) => ({
    status: str(s, "status", "status_code"),
    location: str(s, "location") || null,
    message: str(s, "remark", "message", "status") || null,
    at: str(s, "timestamp", "eventTime", "event_time"),
  }));
  const matched = await applyTrackingUpdate(awb, status, events, "nimbuspost").catch((e) => (console.error(e), false));
  return NextResponse.json({ ok: true, matched });
}
