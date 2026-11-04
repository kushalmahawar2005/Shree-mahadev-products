import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { refreshStaleTracking } from "@/lib/server/shipments";

export async function GET(req: NextRequest) {
  const want = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("x-cron-secret") ?? "";
  if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await refreshStaleTracking()) });
}
