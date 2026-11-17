import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { setOrderStatus } from "@/lib/server/orders";
import { db } from "@/lib/server/db";
import { markWhatsAppFailed } from "@/lib/server/whatsapp";

/**
 * WhatsApp webhook.
 * - Meta Cloud API: GET is the one-time subscription check (hub.verify_token = WHATSAPP_VERIFY_TOKEN);
 *   POST carries customer replies (text, or the YES/NO quick-reply buttons) and delivery statuses.
 *   When WHATSAPP_APP_SECRET is set, the X-Hub-Signature-256 header is checked.
 * - Generic relay (old provider shape): POST { from, text } with header x-whatsapp-secret.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (q.get("hub.mode") === "subscribe" && token && q.get("hub.verify_token") === token) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

type MetaMessage = { from?: string; type?: string; text?: { body?: string }; button?: { text?: string; payload?: string }; interactive?: { button_reply?: { title?: string } } };
type MetaStatus = { id?: string; status?: string; errors?: { code?: number; title?: string; message?: string }[] };
type MetaBody = { object?: string; entry?: { changes?: { value?: { messages?: MetaMessage[]; statuses?: MetaStatus[] } }[] }[] };

function signatureOk(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  // Unsigned requests are accepted only in local development. In production a missing secret means
  // every POST is rejected (otherwise anyone could confirm/cancel COD orders with a fake reply).
  if (!secret) {
    if (process.env.NODE_ENV === "production") console.error("WHATSAPP_APP_SECRET is not set: rejecting webhook");
    return process.env.NODE_ENV !== "production";
  }
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

async function handleReply(fromRaw: string | undefined, textRaw: string | undefined) {
  const from = fromRaw?.replace(/\D/g, "").slice(-10);
  const reply = textRaw?.trim().toUpperCase();
  if (!from || !reply) return;
  if (reply === "STOP") {
    await db().execute("INSERT IGNORE INTO whatsapp_optouts (phone) VALUES (?)", [`91${from}`]);
    return;
  }
  if (reply !== "YES" && reply !== "NO") return;
  const [[order]] = await db().query<RowDataPacket[]>(
    "SELECT id FROM orders WHERE phone = ? AND status = 'cod_pending' ORDER BY id DESC LIMIT 1",
    [from],
  );
  if (order) await setOrderStatus(Number(order.id), reply === "YES" ? "confirmed" : "cancelled", "customer", `WhatsApp replied ${reply}`);
}

export async function POST(request: Request) {
  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if ((body as MetaBody)?.object === "whatsapp_business_account") {
    if (!signatureOk(raw, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    for (const entry of (body as MetaBody).entry ?? [])
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          const text = m.type === "button" ? m.button?.payload || m.button?.text : m.type === "interactive" ? m.interactive?.button_reply?.title : m.text?.body;
          await handleReply(m.from, text).catch((e) => console.error("WhatsApp reply", e));
        }
        for (const st of change.value?.statuses ?? [])
          if (st.status === "failed" && st.id) {
            const err = st.errors?.[0];
            await markWhatsAppFailed(st.id, `Meta ${err?.code ?? ""}: ${err?.message || err?.title || "not delivered"}`).catch(() => {});
          }
      }
    return NextResponse.json({ ok: true });
  }

  if (!process.env.WHATSAPP_WEBHOOK_SECRET || request.headers.get("x-whatsapp-secret") !== process.env.WHATSAPP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const generic = body as { from?: string; text?: string } | null;
  await handleReply(generic?.from, generic?.text);
  return NextResponse.json({ ok: true });
}
