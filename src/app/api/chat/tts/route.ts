import { createHash } from "node:crypto";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/**
 * Chat replies spoken in Dadi ji's voice (ElevenLabs voice clone).
 * Needs ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID on the server; without them this returns 501 and the
 * widget falls back to the browser's own Hindi voice. The key never reaches the browser.
 * Audio for the same text is cached in memory, so repeated answers ("Namaste…") cost nothing.
 */
export const maxDuration = 30;

const Input = z.object({ text: z.string().trim().min(1).max(600) }).strict();
const cache = new Map<string, { audio: ArrayBuffer; at: number }>();
const CACHE_MS = 24 * 60 * 60_000;

export async function POST(request: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return new Response(null, { status: 501 });

  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const text = parsed.data.text;

  const id = createHash("sha256").update(`${voice}|${text}`).digest("hex");
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return audioResponse(hit.audio);

  // Fresh audio costs money: cap per visitor (cached answers above are free).
  const limit = await rateLimit("chat_tts", await clientIp(), 40, 10);
  if (!limit.ok) return new Response(null, { status: 429 });

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
      // Steady, warm and close to the recording: an elderly voice shouldn't swing around.
      voice_settings: { stability: 0.6, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => (console.error("tts", error), null));
  if (!res?.ok) {
    if (res) console.error("tts", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return new Response(null, { status: 502 });
  }
  const audio = await res.arrayBuffer();
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(id, { audio, at: Date.now() });
  return audioResponse(audio);
}

function audioResponse(audio: ArrayBuffer) {
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
}
