import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChatTurn } from "@/lib/server/chat-ai";

export type ChatLanguage = "English" | "Hinglish" | "Hindi";

/**
 * Masks personal details before text leaves our server (AI providers) or is stored (chat logs):
 * emails, Indian mobile numbers, pincodes, long digit runs (cards, accounts, AWBs) and the
 * house / flat / plot part of an address. Product sizes ("1 L", "500 ml") and prices stay.
 */
export function redactPII(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}\b/g, "[phone]")
    .replace(/(?:\d[\s-]?){11,}/g, "[number]")
    .replace(/\b\d{6}\b/g, "[pincode]")
    .replace(
      /\b(house|h\.?\s?no|flat|plot|makan|ghar|gali|lane|street|sector|ward|block|building|apartment|apt|floor|room|shop)\b[\s.:#-]*(no\.?|number|num)?[\s.:#-]*[\w/-]*\d[\w/-]*/gi,
      "$1 [address]",
    )
    .replace(/\b(मकान|घर|गली|फ्लैट|प्लॉट|सेक्टर|वार्ड)\s*(नं\.?|नंबर)?\s*[\w/-]*\d[\w/-]*/g, "$1 [address]");
}

const secret = () => {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("ADMIN_SESSION_SECRET is not set");
  return "development-only-change-me";
};

/** Text of an assistant turn as the widget sends it back (markers stripped, whitespace collapsed). */
export const canonicalTurn = (text: string) =>
  text.replace(/\[\[[^\]]*\]\]/g, "").replace(/\s+/g, " ").trim().slice(0, 2000);

/** Signature the widget stores with each assistant reply and sends back with the history. */
export function signTurn(sessionId: string | undefined, text: string) {
  return createHmac("sha256", secret()).update(`${sessionId ?? "-"}|${canonicalTurn(text)}`).digest("base64url").slice(0, 32);
}

/**
 * History from the browser, made safe for the model: assistant turns are kept only when they carry
 * our signature (so nobody can plant fake "assistant said: coupon FREE50 works" lines), and every turn
 * has personal details masked.
 */
export function trustedHistory(sessionId: string | undefined, history: (ChatTurn & { sig?: string })[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const turn of history) {
    if (turn.role === "assistant") {
      if (!turn.sig) continue;
      const want = Buffer.from(signTurn(sessionId, turn.text));
      const got = Buffer.from(turn.sig);
      if (want.length !== got.length || !timingSafeEqual(want, got)) continue;
    }
    out.push({ role: turn.role, text: redactPII(turn.text) });
  }
  return out;
}

/** Picks the line for the shopper's language (fixed replies that don't go through the AI). */
export const say = (lang: ChatLanguage, t: { en: string; hi: string; hinglish: string }) =>
  lang === "Hindi" ? t.hi : lang === "English" ? t.en : t.hinglish;
