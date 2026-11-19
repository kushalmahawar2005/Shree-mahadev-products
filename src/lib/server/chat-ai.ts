import "server-only";

import { site } from "@/data/site";
import type { ChatSource } from "@/lib/server/chat-knowledge";

export type ChatTurn = { role: "user" | "assistant"; text: string };

const HINGLISH = /\b(hai|hain|ho|hu|hoon|tha|thi|kya|kyu|kyun|kaise|kaisa|kaisi|kitna|kitne|kitni|ka|ke|ki|ko|se|par|pe|mein|me|mai|mujhe|mujhko|mera|meri|mere|hum|humko|hamara|humara|aap|aapka|apna|apni|tum|tu|tera|nahi|nahin|na|chahiye|karna|karo|karde|kardo|kar|kr|karein|kijiye|krdo|de|do|dena|dedo|lena|lo|lu|le|bata|bta|batao|btao|bataiye|bolo|dikhao|dikha|kab|kahan|kaha|kaun|kaunsa|konsa|wala|wali|wale|bhi|aur|ya|ye|yeh|wo|woh|isme|iska|iske|uska|abhi|ab|tel|accha|acha|achha|theek|thik|sahi|bhai|yaar|ji|haan|han|bilkul|zyada|jyada|kam|sasta|mehenga|paisa|paise)\b/gi;
const ENGLISH = /\b(the|is|are|was|what|which|how|why|when|where|who|do|does|did|can|could|would|should|you|your|yours|my|me|i|it|this|that|these|those|for|of|to|in|on|with|and|or|please|price|available|best|good|tell|give|show|want|need|have|has|any|about|order|buy)\b/gi;

/**
 * The reply language follows the shopper's latest message: Devanagari → Hindi; otherwise
 * whichever of Hinglish / English has more marker words. Short, unclear messages ("ok",
 * "5 points") keep the language of their previous message.
 */
/**
 * English as Hindi voice typing spells it ("व्हिच इस योर बेस्ट प्रोडक्ट"). Two lists, and only words that
 * are not also Hindi (so no इस, आर, टू, वन, शो):
 * - grammar words: two or more of these mean the sentence itself is English;
 * - everyday English nouns/verbs Hindi speakers mix in: these mark spoken Hinglish.
 */
const EN_GRAMMAR = new Set(["व्हिच", "व्हाट", "वॉट", "व्हाई", "व्हेन", "व्हेयर", "हाउ", "इज", "इज़", "योर", "यू", "माय", "आई", "कैन", "कुड", "वुड", "शुड", "डू", "डज", "डज़", "प्लीज", "प्लीज़", "गिव", "टेल", "वांट", "नीड", "हैव", "हैज", "एनी", "अबाउट", "फॉर", "ऑफ", "विद", "एंड", "ऑर", "द", "दिस", "दैट", "दीज", "देयर", "मच", "मेनी", "नॉट", "डोंट", "बिटवीन", "इट", "वी"]);
const EN_LOAN = new Set(["बेस्ट", "गुड", "बेटर", "प्राइस", "प्रोडक्ट", "प्रोडक्ट्स", "ऑयल", "ऑइल", "कुकिंग", "हेल्थ", "हेल्दी", "बेनिफिट", "बेनिफिट्स", "डिलीवरी", "शिपिंग", "कॉस्ट", "रिकमेंड", "सजेस्ट", "हेल्प", "थैंक्स", "थैंक", "हेलो", "हाय", "ओके", "यस", "शुगर", "हनी", "मस्टर्ड", "कोकोनट", "ग्राउंडनट", "सेसमी", "सनफ्लावर", "आलमंड", "क्वालिटी", "प्योर", "ऑर्गेनिक", "नेचुरल", "चीप", "डिफरेंस", "यूज", "यूज़", "स्टॉक", "साइज", "साइज़", "लीटर", "ट्रैक", "स्टेटस", "ऑर्डर", "कैंसल", "रिफंड", "पेमेंट", "ऑनलाइन", "ऑफर", "डिस्काउंट", "कूपन", "पार्सल", "ट्रैकिंग", "रिटर्न", "कार्ट", "चेकआउट", "ऐड", "एड", "प्रॉब्लम", "ओरिजिनल", "फ्रेश", "केमिकल", "फ्री", "कैश", "कॉम्बो", "पैक", "बॉटल", "रेट", "ब्रांड", "टेस्ट", "स्किन", "हेयर", "मसाज", "डेली", "फ्राइंग", "डीप"]);

function devanagariWords(message: string) {
  return message.replace(/[^\u0900-\u097F\s]/g, " ").split(/\s+/).filter(Boolean);
}

/** True when a Devanagari message is really an English sentence heard by Hindi voice typing. */
function englishInDevanagari(message: string) {
  const words = devanagariWords(message);
  const grammar = words.filter((word) => EN_GRAMMAR.has(word)).length;
  const loan = words.filter((word) => EN_LOAN.has(word)).length;
  return grammar >= 2 && (grammar + loan) / words.length >= 0.5;
}

/**
 * Language for a message that came from the mic (Hindi voice typing writes everything in
 * Devanagari): English sentence → English; Hindi mixed with English words → Hinglish (reply in
 * Roman letters, the way the shopper talks); pure Hindi → Hindi.
 */
export function voiceLanguage(message: string): "Hindi" | "Hinglish" | "English" {
  if (!/[ऀ-ॿ]/.test(message)) return replyLanguage(message);
  if (englishInDevanagari(message)) return "English";
  return devanagariWords(message).some((word) => EN_LOAN.has(word) || EN_GRAMMAR.has(word)) ? "Hinglish" : "Hindi";
}

export function replyLanguage(message: string, previous?: string): "Hindi" | "Hinglish" | "English" {
  if (/[ऀ-ॿ]/.test(message)) return englishInDevanagari(message) ? "English" : "Hindi";
  const hinglish = message.match(HINGLISH)?.length ?? 0;
  const english = message.match(ENGLISH)?.length ?? 0;
  if (hinglish > english) return "Hinglish";
  if (english > hinglish) return "English";
  return previous ? replyLanguage(previous) : hinglish ? "Hinglish" : "English";
}

const LANGUAGE_RULE = {
  English: "Reply ONLY in English, even if earlier messages were in Hinglish or Hindi.",
  Hinglish: "Reply ONLY in Hinglish (Hindi written in Roman letters), even if earlier messages were in English.",
  Hindi: "Reply ONLY in Hindi written in Devanagari script.",
} as const;

/**
 * Free-tier quotas are per model and per minute, so a 429 on one model falls
 * through to the next before the route gives up and uses the local answer.
 */
// 2.5 models are closed to new keys (404) and only burned an attempt from the 12 s budget.
const MODELS = () => [...new Set([process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"])];
const coolingUntil = new Map<string, number>();
/** Groq (OpenAI-compatible API) is the backup when every Gemini model fails or no Gemini key is set. */
const GROQ_MODELS = () => [...new Set([process.env.GROQ_MODEL || "openai/gpt-oss-120b", "openai/gpt-oss-20b"])];
/** True when at least one AI provider is configured (name kept for existing callers). */
export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

/** Order-intent marker the model appends; the widget strips it and opens the order flow. */
export const ORDER_MARKER = /\[\[orders:(track|cancel|refund|return)\]\]/;

const SYSTEM = `You are "Mahadev Sahayak", the shopping assistant of ${site.name}, a small kachi ghani (wood-pressed) oil, raw honey and natural sweetener brand from Bijainagar, Rajasthan.

Identity: you are the shopper's personal assistant for this store. When the customer greets you (hi, hello, namaste) or asks who you are, introduce yourself in their language, e.g. English: "I am Mahadev Sahayak, your Personal Assistant. How can I help you today?", Hinglish: "Main Mahadev Sahayak hoon, aapka Personal Assistant. Bataiye, kaise madad karun?", Hindi: "मैं महादेव सहायक हूँ, आपका पर्सनल असिस्टेंट। बताइए, कैसे मदद करूँ?" Introduce yourself ONLY when the customer greets you or asks who you are; never add the introduction to other answers.

How to answer:
- Language: mirror the customer's LATEST message exactly. English message → reply fully in English. Hinglish (Hindi in Roman letters) → reply in Hinglish. Hindi in Devanagari → reply in Hindi (Devanagari).
- Style: like a friendly shop assistant on WhatsApp. SHORT. Total reply under 60 words unless the customer asks for detail.
- Write 1 to 3 tiny paragraphs separated by a blank line (each shows as its own chat bubble). Each paragraph is 1-2 short sentences.
- First paragraph answers the question directly (price, yes/no, best pick). Optional second paragraph adds one useful detail. Optional last paragraph is a short follow-up question or next step.
- Product cards (photo, every size, price, Add button) appear automatically under your reply for each product you name. So NEVER write prices or sizes in the text when you recommend products; prices live only on the cards. Exception: if the customer asks the price of one exact size, give that one price.
- Sell with specifics, not generic words like "healthy aur tasty": one concrete reason per product (taste, best use, how it is made). Recommend at most 2 products unless asked for more.
- When the customer wants to compare 2-3 products ("X vs Y", "fark", "difference"), give a one-line verdict and end with [[compare:handle1|handle2]] (a comparison table is shown). Do not also add [[products:…]] then.
- Whenever you recommend or talk about specific products, end with the marker [[products:handle1|handle2]] using handles from the Catalog (max 3), so their cards are shown.
- Bold product names using their simple local name in the customer's language (e.g. Hinglish "**Moongfali tel**", "**Peeli sarson ka tel**"; Hindi "**मूंगफली तेल**"; English "**Groundnut oil**").
- Use **bold** only for product names, prices and key facts. At most one emoji. Never use headings or tables. Never repeat the question.
- Use ONLY facts from STORE INFORMATION below. Never invent prices, sizes, offers, discounts, delivery dates, stock or lab results. If the information is not there, say you are not sure and suggest raising a request in Help & support (/account/help) or the Contact page (/contact). Never give out the store phone or WhatsApp number. Only mention this when you could not fully answer.
- Prices are in Indian rupees (₹). Mention the size with every price.
- Sizes: read the product's "Sizes and prices" in the Catalog / STORE INFORMATION before answering. Every size listed with a ₹ price IS available. Say a size is unavailable ONLY when it is listed as "currently unavailable" or not listed at all.
- When recommending, compare honestly using the store information (taste, use, size, price) and name the product exactly as listed.
- Health: share product facts only. Never claim a product cures, treats or prevents any disease, and never give dosage or medical advice; suggest a doctor for health conditions.
- Stay on topic (the store, its products, cooking with them, orders, shipping, payments, policies). Politely decline anything unrelated.
- Be a helpful, proactive shop assistant (like the best salesperson in a family store), but always honest:
  - When the customer asks about a product (benefits, uses, which one to buy) and their need is not clear yet, answer briefly, then ask ONE follow-up question about what they need it for, and end with quick-reply options using the marker [[options:Option 1|Option 2|Option 3]] (2 to 5 short options in the customer's language). For benefits / "which one" questions the options must be USES (what it is for), not product names. Example uses: Daily cooking, Deep frying, Achaar / tadka, Baal aur skin, Baby massage. For honey/sweeteners: Chai / doodh, Immunity, Bachchon ke liye, Mithai.
  - When you know their need, recommend the 1-2 best matching products from the Catalog with 2-3 crisp reasons (taste, process, best for, price per size). Mention real social proof or low stock ONLY when it appears in STORE INFORMATION, using those exact numbers. Never invent customer counts, ratings, reviews, discounts or urgency.
  - After recommending, end with options that move them forward, e.g. [[options:1 L add karo|500 ml add karo|Aur options dikhao]] (match the real sizes).
  - Do not ask a follow-up if the customer already gave enough detail or just wants a fact (price, COD, delivery).
- Shopping in chat: the customer can add products to their cart right here.
  - If they clearly want to buy / add / order a specific product, reply in one short line and end with the marker [[cart:add|<handle>|<size>|<qty>]] using the handle and exact size from the Catalog. Use ? for size if they did not say a size, and 1 for qty if not said. Example: [[cart:add|groundnut-oil|1 L|2]].
  - With a size: say it is being added (e.g. "Done 👍 1 L × 2 cart mein daal diya."). Without a size: ask them to pick a size from the card below (e.g. "Kaunsa size chahiye? Neeche se chun lijiye 👇"). The product card with sizes and buttons appears automatically.
  - If they say "ye wala" / "isko order karo", use the product discussed in the previous message.
  - If they ask to see their cart, end with [[cart:show]]. If they want to checkout / pay / place the order now, end with [[checkout]].
  - Never say the order is placed: payment and address happen on the secure checkout page. Never ask for address or payment details in chat.
  - Never invent offers or coupon codes.
- Never apologise ("khed hai", "sorry", "pareshani") unless the customer actually reports a problem. No filler lines; answer exactly what was asked.
- Never tell the customer to go to a page (My orders, track order, cart, checkout) for something this chat can do itself; the chat opens it for them. Never mention the words "marker", "tag" or "below marker" to the customer.
- You cannot see any customer's orders. If the customer asks about THEIR OWN order (status, tracking, where is it, cancel, refund, return, damaged item, payment deducted), reply with one short line saying you will open their order details, then end with exactly one marker on its own line: [[orders:track]] or [[orders:cancel]] or [[orders:refund]] or [[orders:return]].
- If STORE INFORMATION does not contain the answer, still reply helpfully (say you are not sure, suggest Help & support) and end with the marker [[unknown]] on its own line, so the team can add the answer later.
- Only add a doctor / medical disclaimer when the customer asks about a disease, medicine, pregnancy or dosage. For general "benefits" questions, share the product's listed benefits and uses.
- Never ask for or repeat phone numbers, addresses, OTPs or payment details.`;

function contextBlock(sources: ChatSource[], catalog: string) {
  const items = sources.map((source, index) => `[${index + 1}] ${source.title} (${source.href})\n${source.excerpt}`).join("\n\n");
  return `STORE INFORMATION\nCatalog: ${catalog}\n\n${items || "(no matching store information found)"}`;
}

const cache = new Map<string, { text: string; at: number }>();
const CACHE_MS = 15 * 60_000;

export function clearAnswerCache() {
  cache.clear();
}

export function cachedAnswer(key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;
  if (hit) cache.delete(key);
  return null;
}

function remember(key: string, text: string) {
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(key, { text, at: Date.now() });
}

/**
 * fetch with a time limit on getting the response headers only; the body (the streamed answer) gets its
 * own, longer limit so a long reply isn't cut off mid-sentence.
 */
async function fetchWithHeaderTimeout(url: string, init: RequestInit, headerMs: number, bodyMs = 20_000) {
  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(new Error(`no response in ${headerMs} ms`)), headerMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(headerTimer);
    const bodyTimer = setTimeout(() => controller.abort(new Error("answer took too long")), bodyMs);
    // Don't keep the process alive just for this timer (aborting a finished stream is a no-op).
    (bodyTimer as unknown as { unref?: () => void }).unref?.();
    return res;
  } catch (error) {
    clearTimeout(headerTimer);
    throw error;
  }
}

/**
 * Streams a grounded Gemini answer as plain text chunks. Throws before the
 * first chunk if Gemini is unavailable, so the caller can fall back to the
 * local answer engine.
 */
export async function streamGeminiAnswer(input: {
  message: string;
  history: ChatTurn[];
  sources: ChatSource[];
  catalog: string;
  cacheKey: string | null;
  /** Shopper's choice from the widget menu; otherwise each message's own language. */
  language?: "English" | "Hinglish" | "Hindi";
  /** The message came from voice typing (may contain mis-heard words; reply will be read aloud). */
  voice?: boolean;
}): Promise<ReadableStream<string>> {
  const contents = [
    ...input.history.slice(-6).map((turn) => ({ role: turn.role === "user" ? "user" : "model", parts: [{ text: turn.text.slice(0, 800) }] })),
    { role: "user", parts: [{ text: `${contextBlock(input.sources, input.catalog)}\n\nLANGUAGE: ${LANGUAGE_RULE[input.language ?? replyLanguage(input.message, input.history.findLast((turn) => turn.role === "user")?.text)]}${input.voice ? `\n\nVOICE: The customer SPOKE this message (voice typing). It may contain mis-heard words, e.g. "कल नेट"/"कोकोनट" = coconut, "ग्राउंड नेट" = groundnut, "मस्टर्ड"/"सरसों" = mustard, "हनी" = honey, "100 नंबर" = 100 ml. Use the earlier conversation to work out what they mean instead of saying you didn't understand. "यह"/"ये"/"इसको" means the product just discussed. Your reply will be read aloud: keep it to 1-2 short sentences, write product names in Hindi.` : ""}\n\nCUSTOMER: ${input.message}` }] },
  ];

  let response = null as Response | null; // assigned inside tryGemini / tryGroq
  let provider = "gemini" as "gemini" | "groq";
  let lastError = "no model available";
  // One budget for the whole answer: at most 3 provider attempts and 12 s to the first byte, so a slow
  // or rate-limited AI can't keep the shopper (and a server worker) waiting minutes before the local answer.
  const deadline = Date.now() + 12_000;
  let attempts = 0;
  const budget = () => {
    const left = deadline - Date.now();
    return attempts < 3 && left > 1_500 ? left : 0;
  };
  const tryGemini = async () => {
    if (response?.body) return;
  for (const model of process.env.GEMINI_API_KEY ? MODELS() : []) {
    if ((coolingUntil.get(model) ?? 0) > Date.now()) continue;
    const left = budget();
    if (!left) break;
    attempts++;
    const attempt = await fetchWithHeaderTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: {
          temperature: 0.3,
          // Replies are meant to be under ~60 words; this leaves room for markers and Devanagari.
          maxOutputTokens: input.voice ? 280 : 500,
          ...(/gemini-[3-9]/.test(model) ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
        },
      }),
    }, Math.min(left, 8_000)).catch((error: unknown) => { lastError = `${model}: ${error instanceof Error ? error.message : "network error"}`; return null; });
    if (attempt?.ok && attempt.body) { response = attempt; break; }
    if (attempt) {
      lastError = `${model} ${attempt.status}: ${(await attempt.text().catch(() => "")).slice(0, 160)}`;
      // Rate-limited or overloaded: rest this model for a minute; other errors (bad key) won't improve on retry.
      if (attempt.status === 429 || attempt.status >= 500) coolingUntil.set(model, Date.now() + 60_000);
      else if (attempt.status !== 404) break;
    }
  }
  };
  const tryGroq = async () => {
    if (response?.body || !process.env.GROQ_API_KEY) return;
    // Backup provider: same system prompt, store context and history, OpenAI-style messages.
    const messages = [
      { role: "system", content: SYSTEM },
      ...contents.map((turn) => ({ role: turn.role === "model" ? "assistant" : "user", content: turn.parts[0].text })),
    ];
    for (const model of GROQ_MODELS()) {
      const key = `groq:${model}`;
      if ((coolingUntil.get(key) ?? 0) > Date.now()) continue;
      const left = budget();
      if (!left) break;
      attempts++;
      const attempt = await fetchWithHeaderTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          // gpt-oss spends some tokens reasoning (kept "low"), so a little more headroom than Gemini.
          model, messages, temperature: 0.3, max_tokens: 700, stream: true,
          // gpt-oss models reason first: keep it short and never stream the reasoning to the shopper.
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
        }),
      }, Math.min(left, 8_000)).catch((error: unknown) => { lastError += ` | groq ${model}: ${error instanceof Error ? error.message : "network error"}`; return null; });
      if (attempt?.ok && attempt.body) {
        console.warn("chat: Gemini unavailable, answering with Groq", { model, lastError });
        response = attempt;
        provider = "groq";
        break;
      }
      if (attempt) {
        lastError += ` | groq ${model} ${attempt.status}: ${(await attempt.text().catch(() => "")).slice(0, 160)}`;
        if (attempt.status === 429 || attempt.status >= 500) coolingUntil.set(key, Date.now() + 60_000);
        else if (attempt.status !== 404) break;
      }
    }
  };
  // Gemini first (it follows the store information and the conversation best; Groq was faster but
  // mixed up products and ran into its free-tier limits in tests), Groq as the backup.
  await tryGemini();
  await tryGroq();
  if (!response?.body) throw new Error(`AI unavailable: ${lastError}`);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let full = "";
  let finished = false;

  /** Parses complete SSE lines; returns the visible text they carry. */
  const parse = (lines: string[]) => {
    let text = "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      if (provider === "groq") {
        const data = line.slice(5).trim();
        if (data === "[DONE]") { finished = true; continue; }
        try {
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string }; finish_reason?: string | null }[] };
          const reason = json.choices?.[0]?.finish_reason;
          if (reason === "stop") finished = true;
          else if (reason) console.warn("chat groq finished early:", reason);
          text += json.choices?.[0]?.delta?.content ?? "";
        } catch { /* keep-alive or malformed line */ }
        continue;
      }
      try {
        const json = JSON.parse(line.slice(5)) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
        const reason = json.candidates?.[0]?.finishReason;
        if (reason === "STOP") finished = true;
        else if (reason) console.warn("chat gemini finished early:", reason);
        text += json.candidates?.[0]?.content?.parts?.map((part) => (part.thought ? "" : part.text ?? "")).join("") ?? "";
      } catch { /* keep-alive or malformed line */ }
    }
    return text;
  };

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (!finished) console.warn("chat AI stream ended without STOP", { provider, chars: full.length });
          const rest = parse(buffer.split(/\r?\n/));
          if (rest) { full += rest; controller.enqueue(rest); }
          if (input.cacheKey && finished && full.trim()) remember(input.cacheKey, full);
          controller.close();
          return;
        }
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        const text = parse(lines);
        if (text) { full += text; controller.enqueue(text); return; }
      }
    },
    cancel() { void reader.cancel(); },
  });
}
