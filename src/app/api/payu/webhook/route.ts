import { NextResponse, type NextRequest } from "next/server";
import { handlePayuResult } from "@/lib/server/payu-process";

/**
 * PayU server-to-server webhook (Dashboard → Webhooks → Payments: success + failure → this URL).
 * Same hash/amount/verify checks as the browser callback; idempotent. Always 200 so PayU stops retrying
 * once we've logged it.
 */
export async function POST(req: NextRequest) {
  const p: Record<string, string> = {};
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(j)) if (v !== null && v !== undefined) p[k] = String(v);
  } else {
    (await req.formData()).forEach((v, k) => {
      if (typeof v === "string") p[k] = v;
    });
  }
  const { outcome } = await handlePayuResult(p, "webhook");
  return NextResponse.json({ ok: true, outcome });
}
