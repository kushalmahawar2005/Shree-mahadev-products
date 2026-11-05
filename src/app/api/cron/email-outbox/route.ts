import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processOutbox } from "@/lib/server/mail";

export async function GET(req: NextRequest) {
  const want = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("x-cron-secret") ?? "";
  if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const counts = await processOutbox(25);
    return NextResponse.json({ ok: true, ...counts });
  } catch (error) {
    console.error("email outbox cron failed", error);
    return NextResponse.json({ ok: false, error: "Email queue could not be processed" }, { status: 500 });
  }
}
