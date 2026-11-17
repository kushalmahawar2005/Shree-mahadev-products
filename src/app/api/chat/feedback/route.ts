import { z } from "zod";
import { NextResponse } from "next/server";
import { setChatFeedback } from "@/lib/server/chat-logs";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

const Input = z.object({ msgKey: z.string().regex(/^[\w-]{6,24}$/), sessionId: z.string().regex(/^[\w-]{6,24}$/), value: z.union([z.literal(1), z.literal(-1)]) }).strict();

export async function POST(request: Request) {
  const limit = await rateLimit("chat_feedback", await clientIp(), 60, 10);
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await setChatFeedback(parsed.data.msgKey, parsed.data.value, parsed.data.sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("chat feedback", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
