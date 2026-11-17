import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { refreshStaleTracking } from "@/lib/server/shipments";
import { purgeDeletedAccounts } from "@/lib/server/account-profile";
import { purgeOldChatLogs } from "@/lib/server/chat-logs";

export async function GET(req: NextRequest) {
  const want = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("x-cron-secret") ?? "";
  if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const tracking = await refreshStaleTracking();
  // Hourly housekeeping riding on this cron: delete accounts past their 7-day deletion grace period.
  const purgedAccounts = await purgeDeletedAccounts().catch((e) => (console.error("purgeDeletedAccounts", e), 0));
  const purgedChatLogs = await purgeOldChatLogs().catch((e) => (console.error("purgeOldChatLogs", e), 0));
  return NextResponse.json({ ok: true, ...tracking, purgedAccounts, purgedChatLogs });
}
