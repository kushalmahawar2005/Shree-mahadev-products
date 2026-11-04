import { NextResponse } from "next/server";
import { setOrderStatus } from "@/lib/server/orders";
import { db } from "@/lib/server/db";

export async function POST(request: Request) {
  if (request.headers.get("x-whatsapp-secret") !== process.env.WHATSAPP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { from?: string; text?: string } | null;
  const from = body?.from?.replace(/\D/g, "").slice(-10);
  const reply = body?.text?.trim().toUpperCase();
  if (!from || !reply) return NextResponse.json({ ok: true });
  if (reply === "STOP") {
    await db().execute("INSERT IGNORE INTO whatsapp_optouts (phone) VALUES (?)", [`91${from}`]);
    return NextResponse.json({ ok: true });
  }
  if (reply !== "YES" && reply !== "NO") return NextResponse.json({ ok: true });
  const [[order]] = await db().query<{ id: number }[] & import("mysql2/promise").RowDataPacket[]>(
    "SELECT id FROM orders WHERE phone = ? AND status = 'cod_pending' ORDER BY id DESC LIMIT 1",
    [from],
  );
  if (order) await setOrderStatus(order.id, reply === "YES" ? "confirmed" : "cancelled", "customer", `WhatsApp replied ${reply}`);
  return NextResponse.json({ ok: true });
}
