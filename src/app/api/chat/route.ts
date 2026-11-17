import { z } from "zod";
import { NextResponse } from "next/server";
import { cachedAnswer, geminiEnabled, replyLanguage, streamGeminiAnswer, voiceLanguage } from "@/lib/server/chat-ai";
import { logChat } from "@/lib/server/chat-logs";
import { blocksFromReply, productBlocks } from "@/lib/server/chat-blocks";
import { getChatKnowledge, normalizeChatText, searchChatKnowledge, type ChatSource } from "@/lib/server/chat-knowledge";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

const Input = z.object({
  message: z.string().trim().min(1).max(500),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(12).optional(),
  sessionId: z.string().regex(/^[\w-]{6,24}$/).optional(),
  msgKey: z.string().regex(/^[\w-]{6,24}$/).optional(),
  language: z.enum(["English", "Hinglish", "Hindi"]).optional(),
  /** The message came from the mic (Hindi voice typing): its language is read differently. */
  voice: z.boolean().optional(),
}).strict();

const productCards = (sources: ChatSource[]) => sources.flatMap((source) => source.product ? [source.product] : []).slice(0, 4);
const ndjson = (value: unknown) => `${JSON.stringify(value)}\n`;
const orderWords = /\b(my orders?|mere orders?|meri orders?|mere sare orders?|sab(hi)? orders?|all (my )?orders|order history|past orders?|previous orders?|old orders?|pichh?le orders?|purane orders?|orders? dikha(o|na|do|iye|ye)?|orders? batao|orders? check|my parcel|my refund|my payment|order status|order number|track( my)? order|tracking|awb|courier|where('?s| is) my|mera order|meri order|mera parcel|meri parcel|pahuncha|pahuchega|kaha hai mera|kahan hai mera|radd.*order|cancel.*order|order.*cancel|refund status|refund.*my order|order.*refund|return.*my order|my return|paise (kate|kat gaye|wapis)|paisa (kata|wapas)|money (deducted|taken)|deducted.*order|unpaid.*order|utr|मेरे ऑर्डर|मेरा ऑर्डर|मेरी ऑर्डर|ऑर्डर की स्थिति|ऑर्डर स्टेटस|ऑर्डर ट्रैक|ऑर्डर कैंसल|ऑर्डर रद्द|ऑर्डर रिफंड|मेरा पार्सल|पैसे वापस|पैसे कटे|पैसे कट गए|रिफंड स्टेटस|मेरा रिफंड|मेरी डिलीवरी)\b/i;
const hindiOrderWords = /मेरे ऑर्डर|पिछले ऑर्डर|पुराने ऑर्डर|सारे ऑर्डर|ऑर्डर दिखाओ|मेरा ऑर्डर|मेरी ऑर्डर|ऑर्डर की स्थिति|ऑर्डर स्टेटस|ऑर्डर ट्रैक|ऑर्डर कैंसल|ऑर्डर रद्द|ऑर्डर रिफंड|मेरा पार्सल|पैसे वापस|पैसे कटे|पैसे कट गए|रिफंड स्टेटस|मेरा रिफंड|मेरी डिलीवरी/;
const medicalAdviceWords = /\b(diabetes|diabetic|blood pressure|bp|heart disease|cancer|arthritis|pregnan\w*|cure|treat\w*|medicine|medical advice|doctor|disease|cholesterol|thyroid|weight loss|dosage)\b/i;
const hindiMedicalAdviceWords = /डायबिटीज|मधुमेह|ब्लड प्रेशर|बीपी|दिल की बीमारी|कैंसर|गठिया|गर्भवती|इलाज|दवा|डॉक्टर|बीमारी|कोलेस्ट्रॉल|थायरॉइड|वजन घटाने/;

const greetingWords = /^\s*(hi+|hello+|hey+|hii+|namaste|namaskar|ram ram|jai shree krishna|good (morning|afternoon|evening)|who are you|aap kaun (ho|hain)|tum kaun ho|नमस्ते|नमस्कार|राम राम|आप कौन हैं?)[\s!.?🙏]*$/i;
const hindiScript = /[\u0900-\u097F]/;
/** Own-order problems the broad order regex misses ("refund kab aayega", "bottle leak hokar aayi"). */
const orderProblemWords = /\b(refund|paisa|paise)\b.*\b(kab|when|nahi|status|aaya|aayega|mila)\b|\b(leak|leaking|toot|tuta|tooti|tuti|broken|damaged?|kharab|galat|wrong|missing)\b.*\b(aaya|aayi|aya|ayi|mila|mili|received|hua|hui|delivered|nikla|nikli)\b|\bnahi (aaya|aayi|mila|pahuncha)\b/i;

const cartWords = /\b(my cart|view cart|show (me )?(my )?cart|cart (dikhao|dikha|batao|me kya|mein kya)|mera cart|mere cart|basket)\b|मेरा कार्ट|कार्ट दिखाओ/i;
const checkoutWords = /^\s*(checkout|check out|checkout dobara kholo|cod se order karein|place (the )?order|buy now|payment karna|pay now|order place kar(o|do|na)|order kar (do|de|dijiye)|checkout kar(o|do|na)?|khareedna hai|kharidna hai|khareed(o|na)|ab order karna hai)\s*[.!?]*$/i;
/** "haan" / "confirm" only reopens the checkout card (never places an order) when checkout was just discussed. */
const yesWords = /^\s*(haan|ha|han|yes|ok|okay|confirm|confirm karo|theek hai)\s*[.!?]*$/i;
const reorderWords = /(wahi|wohi|same|pichhla|pichla|last)\s*(order)?\s*(dobara|phir se|repeat|again)|(repeat|reorder)\s*(my\s*)?(last\s*)?order|dobara mangwa/i;
/** Card numbers (Luhn), CVV / UPI PIN / OTP: never sent to Gemini or written to logs. */
function looksLikePaymentSecret(text: string) {
  const card = /\d{13,19}/.exec(text.replace(/[\s-]/g, ""))?.[0];
  if (card) {
    let sum = 0;
    for (let i = 0; i < card.length; i++) { let d = Number(card[card.length - 1 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    if (sum % 10 === 0) return true;
  }
  return /\b(otp|cvv|cvc|upi\s*pin|atm\s*pin|pin)\b[^\d]{0,20}\d{3,6}\b|\b\d{3,6}\b[^\d]{0,12}\b(otp|cvv|upi\s*pin|pin)\b/i.test(text);
}

const addIntent = /\b(add|daal\w*|dal(o|do|na)?|buy|kharid\w*|order\s*kar\w*|mangwa\w*|le\s*l(o|unga|ungi|enge)|lena\s*hai)\b|डाल|जोड़|खरीद|मंगवा/i;

const sizeKey = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/litre|liter|ltr/g, "l").replace(/gram|gm/g, "g").replace(/kgs?/g, "kg");

/** Turns the model's [[cart:…]] / [[checkout]] marker into a concrete action the widget can run. */
function cartAction(text: string, knowledge: Awaited<ReturnType<typeof getChatKnowledge>>, message: string, context: string) {
  if (/\[\[checkout\]\]/.test(text)) return { action: "checkout" as const };
  if (/\[\[cart:show\]\]/.test(text)) return { action: "cart" as const };
  let add = text.match(/\[\[cart:add\|([^|\]]+)\|([^|\]]*)\|(\d+)\]\]/);
  if (!add && addIntent.test(message)) {
    // The model sometimes forgets the marker: if the shopper clearly wants to add and one product is
    // named in their message, the reply, or the previous answer, still show the add card.
    const haystacks = [message, text, context].map((value) => value.toLowerCase());
    for (const hay of haystacks) {
      const hits = knowledge.filter((entry) => entry.product && hay.includes(entry.product.title.toLowerCase().replace(/^wood-pressed\s+/, "")));
      if (hits.length === 1) {
        const qty = message.match(/\b(\d{1,2})\s*(bottle|bottles|jar|jars|pack|packs|piece|pcs|nos)\b/i)?.[1] ?? "1";
        add = ["", hits[0].product!.handle, "?", qty] as unknown as RegExpMatchArray;
        break;
      }
      if (hits.length > 1) break;
    }
  }
  if (!add) return null;
  const product = knowledge.find((entry) => entry.product?.handle === add[1].trim())?.product;
  if (!product) return null;
  // Only trust a size the shopper actually typed; otherwise the card asks (default size preselected).
  const saidSize = /\d+(\.\d+)?\s*(ml|l|ltr|litre|liter|lit|kg|g|gm|gram|grams)\b|\b(litre|liter|kilo|half)\b|लीटर|किलो|ग्राम/i.test(message);
  const size = saidSize ? add[2].trim() : "?";
  const variant = size && size !== "?" ? product.variants.find((item) => sizeKey(item.title) === sizeKey(size)) : undefined;
  return { action: "add" as const, product, variantId: variant?.available ? variant.id : null, qty: Math.min(Math.max(Number(add[3]) || 1, 1), 10) };
}

export async function POST(request: Request) {
  const limit = await rateLimit("chat_answer", await clientIp(), 40, 10);
  if (!limit.ok) return NextResponse.json({ error: `Please wait ${limit.retryInMin} min before asking more questions.` }, { status: 429 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Please enter a question." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Please enter a question under 500 characters." }, { status: 400 });

  const message = parsed.data.message;
  const history = parsed.data.history ?? [];
  const { sessionId, msgKey } = parsed.data;
  const log = (answer: string, engine: Parameters<typeof logChat>[0]["engine"], answered = true) => logChat({ sessionId, msgKey, question: message, answer, engine, answered });
  if (looksLikePaymentSecret(message)) {
    return NextResponse.json({
      answer: "⚠️ Card number, CVV, UPI PIN ya OTP kabhi chat mein mat likhiye. Payment sirf PayU ke secure page par hota hai.",
      blocks: [{ type: "notice", tone: "warning", text: "Yeh message save nahi kiya gaya." }],
    });
  }
  if (medicalAdviceWords.test(message) || hindiMedicalAdviceWords.test(message)) {
    log("medical disclaimer", "medical");
    return NextResponse.json({
      answer: "Product information on this site is not medical advice. Please ask a qualified doctor about health conditions, medicines, pregnancy or dosage. I can still help with product ingredients and published lab reports.",
      sources: [{ title: "Terms of service", href: "/policies/terms" }, { title: "Lab reports", href: "/lab-reports" }],
    });
  }
  const lastAssistantText = history.findLast((turn) => turn.role === "assistant")?.text ?? "";
  if (reorderWords.test(message)) {
    log("reorder", "orders");
    return NextResponse.json({ answer: "Pichhla order dobara cart mein daal raha hoon…", action: "reorder" });
  }
  if (yesWords.test(message) && /checkout|confirm|order/i.test(lastAssistantText)) {
    log("checkout card", "local");
    return NextResponse.json({ answer: "Order neeche se confirm kijiye 👇", blocks: [{ type: "checkout_card" }] });
  }
  const wantsToAdd = addIntent.test(message);
  if ((cartWords.test(message) && !wantsToAdd) || checkoutWords.test(message)) {
    const checkout = checkoutWords.test(message);
    const answer = checkout ? "Checkout ke liye taiyaar! 🛒 Address aur payment chun kar confirm kijiye." : "Yeh raha aapka cart 🛒";
    log(answer, "local");
    return NextResponse.json({ answer, blocks: [{ type: checkout ? "checkout_card" : "cart_summary" }] });
  }
  if (greetingWords.test(message)) {
    const english = /^[\s\w!.?]*$/.test(message) && !/namaste|namaskar|ram ram|aap|tum|jai/i.test(message);
    const answer = hindiScript.test(message)
      ? "नमस्ते 🙏 मैं **महादेव सहायक** हूँ, आपका पर्सनल असिस्टेंट। बताइए, कैसे मदद करूँ?"
      : english
        ? "Hello 🙏 I am **Mahadev Sahayak**, your Personal Assistant. How can I help you today?"
        : "Namaste 🙏 Main **Mahadev Sahayak** hoon, aapka Personal Assistant. Bataiye, kaise madad karun?";
    log(answer, "local");
    return NextResponse.json({ answer, sources: [] });
  }
  if (orderWords.test(message) || hindiOrderWords.test(message) || orderProblemWords.test(message)) {
    log("opened order flow", "orders");
    return NextResponse.json({
      // One short line: the order cards that follow are the real answer.
      answer: hindiScript.test(message) ? "आपके ऑर्डर देख रहा हूँ… 🔍" : "Aapke orders dekh raha hoon… 🔍",
      sources: [],
      action: "orders",
    });
  }

  try {
    const knowledge = await getChatKnowledge();
    const results = searchChatKnowledge(message, knowledge);

    if (geminiEnabled()) {
      // Follow-ups ("aur 5 litre?") need the previous question's context too.
      const lastUser = history.findLast((turn) => turn.role === "user")?.text ?? "";
      // The new message's own matches come first; the previous question only adds context for follow-ups.
      const grounding = [...searchChatKnowledge(message, knowledge, 6, 900), ...(lastUser ? searchChatKnowledge(`${message} ${lastUser}`, knowledge, 4, 900) : [])]
        .filter((entry, index, all) => all.findIndex((other) => other.href === entry.href && other.title === entry.title) === index)
        .slice(0, 9);
      const catalog = knowledge.flatMap((entry) => entry.product ? [`${entry.product.title} [handle: ${entry.product.handle}] (${entry.excerpt.match(/^Sizes and prices: ([^.]*)/)?.[1] ?? `from ₹${entry.product.price}`})`] : []).join("; ");
      const language = parsed.data.language ?? (parsed.data.voice ? voiceLanguage(message) : undefined);
      const cacheKey = history.length ? null : `${language ?? replyLanguage(message)}:${normalizeChatText(message).sort().join(" ")}`;
      // Only strong matches become "read more" links; weak keyword hits looked random under AI answers.
      const strong = results.filter((result) => (result.score ?? 0) >= 5).slice(0, 2);

      const cached = cacheKey ? cachedAnswer(cacheKey) : null;
      try {
        const answer = cached
          ? new ReadableStream<string>({ start(controller) { controller.enqueue(cached); controller.close(); } })
          : await streamGeminiAnswer({ message, history, sources: grounding, catalog, cacheKey, language });
        let full = "";
        const body = answer.pipeThrough(new TransformStream<string, string>({
          transform(delta, controller) { full += delta; controller.enqueue(ndjson({ type: "text", delta })); },
          flush(controller) {
            const action = cartAction(full, knowledge, message, history.findLast((turn) => turn.role === "assistant")?.text ?? "");
            const blocks = blocksFromReply({ full, knowledge, action, strongSources: strong });
            if (blocks.length) controller.enqueue(ndjson({ type: "blocks", blocks }));
            const unknown = full.includes("[[unknown]]");
            const orders = /\[\[orders:/.test(full);
            log(full.replace(/\[\[[^\]]*\]\]/g, "").trim(), orders ? "orders" : cached ? "cache" : "ai", !unknown && full.trim().length > 0);
            controller.enqueue(ndjson({ type: "done" }));
          },
        })).pipeThrough(new TextEncoderStream());
        return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
      } catch (error) {
        console.error("chat gemini, using local answer", error);
      }
    }

    if (!results.length) {
      log("no match", "local", false);
      return NextResponse.json({
        answer: "Iska pakka jawab mere paas abhi nahi hai. Hamari team aapki madad kar degi.",
        blocks: [{ type: "handoff" }],
      });
    }
    log(results[0].excerpt, "local");
    const top = results[0];
    return NextResponse.json({
      answer: top.product ? `**${top.title}** ke baare mein:` : "Yeh jaankari mili:",
      blocks: top.product
        ? productBlocks(productCards(results))
        : [{ type: "info_card", title: top.title, body: top.excerpt.slice(0, 420), href: top.href, source: "Store info" }, ...(results.length > 1 ? [{ type: "quick_replies", options: results.slice(1, 4).map(({ title }) => title.slice(0, 60)) }] : [])],
    });
  } catch (error) {
    console.error("chat answer", error);
    return NextResponse.json({
      answer: "I couldn't load the store information just now. Please try again or contact our team.",
      sources: [],
      suggestions: [{ label: "Contact support", href: "/contact" }],
    });
  }
}
