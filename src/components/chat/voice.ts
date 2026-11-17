"use client";

/**
 * Speaks a chat reply: Dadi ji's cloned voice from /api/chat/tts when the server has it set up,
 * otherwise the browser's own Hindi (or Indian English) voice, slowed down and a little lower so it
 * sounds warm. One reply plays at a time; stopSpeaking() cuts it off (mic tap, chat closed, new question).
 */

let current: { audio?: HTMLAudioElement; cancelled: boolean } | null = null;
let serverVoice: boolean | null = null; // null = unknown, false = not configured (skip the request)

/**
 * Text a person would say: no markdown, markers, links, emoji or product-card noise. For a Hindi voice,
 * prices and sizes become Hindi words right here ("₹215" → "215 रुपये", "100 ml" → "100 एम एल"), so a
 * Devanagari reply needs no extra conversion call before speaking.
 */
export function speakableText(text: string, hindi = false) {
  let t = text
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_`#>]+/g, "")
    .replace(/\p{Extended_Pictographic}|\uFE0F/gu, "");
  t = hindi
    ? t
        .replace(/₹\s?([\d,]+)/g, (_, n: string) => `${n.replace(/,/g, "")} रुपये`)
        .replace(/(\d)\s?ml\b/gi, "$1 एम एल")
        .replace(/(\d)\s?(l|ltr|litre|liter)\b/gi, "$1 लीटर")
        .replace(/(\d)\s?kg\b/gi, "$1 किलो")
        .replace(/(\d)\s?(g|gm|gram)\b/gi, "$1 ग्राम")
    : t.replace(/₹\s?([\d,]+)/g, (_, n: string) => `${n.replace(/,/g, "")} rupees`);
  return t.replace(/\s+/g, " ").trim().slice(0, 600);
}

export function stopSpeaking() {
  if (current) {
    current.cancelled = true;
    current.audio?.pause();
  }
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Best voice the shopper's device has, in order of quality:
 * Hindi: Chrome "Google हिन्दी" → Apple "Lekha" / "Kiyara" → Microsoft "Swara" → any hi-IN.
 * English: an Indian English voice → Chrome "Google UK English Female" → any English female → any English.
 */
const HINDI_PREFS = [/google\s*हिन्दी|google hindi/i, /lekha/i, /kiyara/i, /swara/i];
const ENGLISH_PREFS = [/google.*(india|en-in)/i, /(veena|neerja|heera|kalpana)/i, /google uk english female/i, /(samantha|female)/i];

function pickVoice(lang: "hi" | "en") {
  const voices = window.speechSynthesis.getVoices();
  const pool = voices.filter((v) => (lang === "hi" ? /^hi/i.test(v.lang) : /^en/i.test(v.lang)));
  for (const pref of lang === "hi" ? HINDI_PREFS : ENGLISH_PREFS) {
    const hit = pool.find((v) => pref.test(v.name));
    if (hit) return hit;
  }
  if (lang === "en") return pool.find((v) => /^en-IN/i.test(v.lang)) ?? pool[0] ?? null;
  return pool[0] ?? null;
}

// Chrome loads its voice list asynchronously: ask once early so the first reply already gets the good voice.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mobile browsers only let a page speak after a user gesture. Call this from the mic / 🔊 tap: a silent
 * utterance "unlocks" speech so the answer that arrives seconds later can be read out.
 */
export function primeSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.resume();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  synth.speak(u);
}

async function browserSpeak(text: string, lang: "hi" | "en", token: { cancelled: boolean }) {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  // Chrome (esp. Android) silently drops speak() right after cancel(): clear, wait a beat, resume.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    await sleep(120);
  }
  synth.resume();
  if (token.cancelled) return;
  // Chrome stops long utterances after ~15 s: speak sentence by sentence.
  const parts = text.match(/[^.!?।]+[.!?।]?/g)?.map((p) => p.trim()).filter(Boolean) ?? [text];
  const voice = pickVoice(lang);
  await new Promise<void>((resolve) => {
    let left = parts.length;
    // Never hang if the browser doesn't report the end (it sometimes doesn't after a cancel).
    const guard = setTimeout(resolve, text.length * 110 + 4000);
    const done = () => {
      left -= 1;
      if (left <= 0 || token.cancelled) {
        clearTimeout(guard);
        resolve();
      }
    };
    for (const part of parts) {
      const u = new SpeechSynthesisUtterance(part);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? (lang === "hi" ? "hi-IN" : "en-IN");
      u.rate = 1.05; // natural chat pace (0.9 felt slow)
      u.pitch = 0.95; // a touch warmer than default
      u.onend = u.onerror = done;
      synth.speak(u);
    }
  });
}

let filler: Promise<void> | null = null;

/**
 * A short "जी, देखती हूँ…" while the answer is being prepared (only when it takes a moment), so a
 * spoken conversation never feels dead. The real answer waits for it to finish (≤ 1.5 s).
 */
export function speakFiller(lang: "Hindi" | "Hinglish" | "English") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const lines = lang === "English" ? ["One moment…", "Let me check…", "Sure, just a second…"] : ["जी, देखती हूँ…", "एक सेकंड…", "हाँ जी, बताती हूँ…", "अच्छा, देखती हूँ…"];
  const token = { cancelled: false };
  filler = browserSpeak(lines[Math.floor(Math.random() * lines.length)], lang === "English" ? "en" : "hi", token).finally(() => {
    filler = null;
  });
}

/** Dadi ji's cloned voice (ElevenLabs) only when the site is set up for it; otherwise no extra request. */
const SERVER_VOICE = process.env.NEXT_PUBLIC_DADI_VOICE === "1";

/** Speak `text`; resolves when finished (or stopped). `lang`: reply language of the chat. */
export async function speak(text: string, lang: "Hindi" | "Hinglish" | "English") {
  // Let a filler line finish instead of cutting it mid-word (bounded wait).
  if (filler) await Promise.race([filler, sleep(1500)]);
  stopSpeaking();
  let clean = speakableText(text, lang !== "English");
  if (!clean) return;
  const token: { audio?: HTMLAudioElement; cancelled: boolean } = { cancelled: false };
  current = token;

  // Hindi voices mispronounce Hinglish written in Roman letters: only then fetch a Devanagari version
  // (voice replies already come in Devanagari, so this extra call is skipped for them).
  const latin = (clean.match(/[a-z]/gi)?.length ?? 0) / Math.max(1, clean.replace(/[\s\d.,!?।]/g, "").length);
  if (lang !== "English" && latin > 0.3) {
    try {
      const res = await fetch("/api/chat/speakable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean, lang }) });
      const data = (await res.json()) as { text?: string | null };
      if (data.text) clean = data.text;
    } catch {
      /* speak the original */
    }
    if (token.cancelled) return;
  }

  if (SERVER_VOICE && serverVoice !== false) {
    try {
      const res = await fetch("/api/chat/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean }) });
      if (res.status === 501) serverVoice = false;
      if (res.ok) {
        serverVoice = true;
        const url = URL.createObjectURL(await res.blob());
        if (token.cancelled) return URL.revokeObjectURL(url);
        const audio = new Audio(url);
        token.audio = audio;
        await new Promise<void>((resolve) => {
          audio.onended = audio.onerror = audio.onpause = () => resolve();
          void audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      /* network: fall back to the browser voice */
    }
  }
  if (token.cancelled) return;
  await browserSpeak(clean, lang === "English" ? "en" : "hi", token);
}

export const canSpeak = () => typeof window !== "undefined" && ("speechSynthesis" in window || "Audio" in window);
