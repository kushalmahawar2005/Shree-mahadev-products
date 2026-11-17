import { NextResponse } from "next/server";
import { clearGuestChatOrderAccess, requestGuestChatOrderOtp, verifyGuestChatOrderOtp } from "@/lib/server/chat-orders";

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof raw !== "object" || raw === null || !("action" in raw)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const action = (raw as { action?: unknown }).action;
  const payload = Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([key]) => key !== "action"));
  const result = action === "forget"
    ? await clearGuestChatOrderAccess().then(() => ({ ok: true as const }))
    : action === "send"
    ? await requestGuestChatOrderOtp(payload)
    : action === "verify"
      ? await verifyGuestChatOrderOtp(payload)
      : { ok: false as const, error: "Invalid request." };
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
