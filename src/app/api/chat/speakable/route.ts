import { createHash } from "node:crypto";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/**
 * Turns a chat reply into text a Hindi voice pronounces well: Hinglish written in Roman letters
 * ("Moongfali ka tel roz ke khaane ke liye best hai") becomes Devanagari ("मूंगफली का तेल …"),
 * prices / sizes become words. English replies come back unchanged. Cached; on any failure the
 * widget just speaks the original text.
 */
export const maxDuration = 15;

const Input = z.object({ text: z.string().trim().min(1).max(600), lang: z.enum(["Hindi", "Hinglish", "English"]) }).strict();
const cache = new Map<string, string>();

const PROMPT = `Rewrite the shop assistant's reply below so a Hindi text-to-speech voice reads it naturally.
Rules:
- Output ONLY the rewritten text, nothing else.
- Write everything in Devanagari script (Hindi). Hinglish words → Devanagari ("aap" → "आप", "tel" → "तेल").
- English words people say as-is in Hindi stay, but in Devanagari ("best" → "बेस्ट", "order" → "ऑर्डर", "cart" → "कार्ट", "delivery" → "डिलीवरी", "COD" → "सी ओ डी").
- Product names in simple Hindi: Groundnut oil → मूंगफली का तेल, Yellow mustard oil → पीली सरसों का तेल, Black mustard oil → काली सरसों का तेल, Coconut oil → नारियल का तेल, Sesame oil → तिल का तेल, Flaxseed oil → अलसी का तेल, Castor oil → अरंडी का तेल, Raw honey → कच्चा शहद, Deshi khand → देसी खांड.
- Prices and sizes as spoken words: "₹491" → "चार सौ इक्यानवे रुपये", "1 L" → "एक लीटर", "500 ml" → "पांच सौ एम एल", "1 kg" → "एक किलो".
- Keep the meaning and the friendly tone. Do not add or remove information. No emoji, no markdown.`;

export async function POST(request: Request) {
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ text: null }, { status: 400 });
  const { text, lang } = parsed.data;
  // Already Devanagari, or English: nothing to convert.
  if (lang === "English" || /^[ऀ-ॿ\s\d.,!?।:;'"()-]+$/.test(text)) return Response.json({ text });

  const id = createHash("sha256").update(text).digest("hex");
  const hit = cache.get(id);
  if (hit) return Response.json({ text: hit });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ text });
  const limit = await rateLimit("chat_speakable", await clientIp(), 60, 10);
  if (!limit.ok) return Response.json({ text });

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"; // same default as the chat (2.5 is closed to new keys)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 600, ...(/gemini-[3-9]/.test(model) ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}) },
    }),
    signal: AbortSignal.timeout(6_000),
  }).catch(() => null);
  if (!res?.ok) return Response.json({ text });
  const json = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] } | null;
  const out = json?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
  // Sanity: must be mostly Devanagari and not wildly longer than the input.
  const devanagari = (out?.match(/[ऀ-ॿ]/g)?.length ?? 0) / Math.max(1, out?.replace(/\s/g, "").length ?? 1);
  if (!out || devanagari < 0.5 || out.length > text.length * 3) return Response.json({ text });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(id, out);
  return Response.json({ text: out });
}
