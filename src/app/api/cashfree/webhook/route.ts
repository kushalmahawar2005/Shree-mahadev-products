import { NextResponse, type NextRequest } from "next/server";
import { handleCashfreeWebhook } from "@/lib/server/cashfree-process";

/**
 * Cashfree server-to-server webhook (also sent per order as notify_url). Signature is checked on the raw
 * body, then the real status is fetched from Cashfree's API; idempotent. 200 once logged so Cashfree stops retrying.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const res = await handleCashfreeWebhook(raw, req.headers.get("x-webhook-timestamp"), req.headers.get("x-webhook-signature"));
  if (!res.ok) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, outcome: res.outcome });
}
