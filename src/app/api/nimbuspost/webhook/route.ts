import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logWebhook } from "@/lib/server/orders";
import { applyTrackingUpdate } from "@/lib/server/shipments";

/**
 * NimbusPost status webhook. Configure in NimbusPost → Settings → Webhooks as:
 *   https://<site>/api/nimbuspost/webhook?secret=<NIMBUSPOST_WEBHOOK_SECRET>
 * Every payload is logged (webhook_logs) so field names can be checked against real events.
 */
function authorised(req: NextRequest) {
  const expected = process.env.NIMBUSPOST_WEBHOOK_SECRET ?? "";
  const got = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-webhook-secret") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return String(o[k]);
  return "";
};

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });

  const data = (typeof body.data === "object" && body.data ? body.data : body) as Record<string, unknown>;
  const awb = pick(data, "awb_number", "awb", "awbno");
  const status = pick(data, "status", "current_status", "shipment_status", "status_code");
  await logWebhook("nimbuspost", awb || null, body, status || undefined).catch((e) => console.error("logWebhook", e));
  if (!awb || !status) return NextResponse.json({ ok: true, ignored: true });

  const history = (data.history ?? data.scans ?? []) as Record<string, unknown>[];
  const events = Array.isArray(history)
    ? history.map((h) => ({
        status: pick(h, "status_code", "status"),
        location: pick(h, "location") || null,
        message: pick(h, "message", "status") || null,
        at: pick(h, "event_time", "date", "time"),
      }))
    : [];
  const found = await applyTrackingUpdate(awb, status, events, "nimbuspost").catch((e) => (console.error(e), false));
  return NextResponse.json({ ok: true, matched: found });
}
