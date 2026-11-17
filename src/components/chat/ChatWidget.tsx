"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { ArrowUp, Check, Copy, Mic, ShieldCheck, Square, ThumbsDown, ThumbsUp, Volume2, VolumeX, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RichText, SourceLinks, TypingWave, textClass, type Source, type Suggestion } from "@/components/chat/ChatParts";
import { AddToCartCard, CartCard, ShopCards, type CartIntent, type ShopProduct } from "@/components/chat/ChatCommerce";
import { ChatHeader, type ChatLanguage } from "@/components/chat/ChatHeader";
import { ChatTabBar, type ChatTab } from "@/components/chat/ChatTabBar";
import { CHIP_ICONS, ChatWelcome, ChipRow, type Chip, type WelcomeContext } from "@/components/chat/ChatWelcome";
import { ease, rise, small, spring, staggerParent, tabSwap, tap } from "@/components/chat/motion";
import type { OrderRow } from "@/components/chat/tabs/OrdersTab";
import { useCart } from "@/components/cart/CartProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { canSpeak, primeSpeech, speak, speakFiller, stopSpeaking } from "@/components/chat/voice";
import { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor } from "@/components/shadcn/chat-container";
import { PromptInput, PromptInputAction, PromptInputActions, PromptInputTextarea } from "@/components/shadcn/prompt-input";
import { ScrollButton } from "@/components/shadcn/scroll-button";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { BlockList, type BlockHandlers } from "@/components/chat/ChatBlocks";
import { parseBlocks, type ChatBlock, type ChatBlockOf } from "@/lib/chat/blocks";
import { reorderAction } from "@/lib/customer-account-actions";
import { requestReturnAction } from "@/lib/account/order-actions";
import { submitSupportTicketAction } from "@/lib/account/support-actions";
import { PAY_RESUME_KEY } from "@/components/chat/CheckoutCard";
import { RETURN_CHOICES } from "@/components/chat/ChatBlocks";
import { cancelMyOrderAction, requestCancelOrderAction } from "@/lib/customer-account-actions";

type ChatMessage = { role: "assistant" | "user"; text: string; key?: string; blocks?: ChatBlock[]; login?: Intent; sources?: Source[]; suggestions?: Suggestion[]; products?: ShopProduct[]; cart?: CartIntent; options?: string[]; streaming?: boolean; feedback?: 1 | -1;
  /** Server's canonical text + signature for this reply; sent back in the history so it is trusted. */
  turn?: string; sig?: string };
type Intent = "track" | "cancel" | "refund" | "return";

/** Language for the widget's own fallback lines: the menu choice, else the shopper's last message. */
function langOf(language: string, lastText: string): "Hindi" | "Hinglish" | "English" {
  if (language === "Hindi" || language === "Hinglish" || language === "English") return language;
  if (/[\u0900-\u097F]/.test(lastText)) return "Hindi";
  return /\b(what|which|how|is|are|the|please|price|can|do|does|my|i)\b/i.test(lastText) && !/\b(hai|kya|kaise|ka|ki|ke|mein|aap|chahiye|kitna|nahi)\b/i.test(lastText) ? "English" : "Hinglish";
}
function lineFor(language: string, lastText: string, t: { en: string; hinglish: string; hi: string }) {
  const lang = langOf(language, lastText);
  return lang === "Hindi" ? t.hi : lang === "English" ? t.en : t.hinglish;
}
type SpeechCtor = new () => { lang: string; interimResults: boolean; onresult: (event: { results: { 0: { transcript: string } }[] }) => void; onerror: (event: { error: string }) => void; onend: () => void; start: () => void; stop: () => void };
type Order = { id: number; orderNo: string; status: string; createdAt: string; eta?: string | null };
type OrderDetail = {
  id: number; orderNo: string; status: string; createdAt: string; method?: string; eta?: string | null;
  courier?: string | null; awb?: string | null; trackingUrl?: string | null;
  tracking?: { status: string; expectedDelivery?: string | null; courier?: string | null; awb?: string | null; trackingUrl?: string | null; events?: { status: string; label: string; at: string; location: string | null }[] } | null;
  refunds?: { amount: number; status: string; at: string; ref?: string | null }[];
  canCancel?: { ok: true } | { ok: false; reason: string; canRequest?: boolean };
  cancelRule?: { ok: true } | { ok: false; reason: string; canRequest?: boolean };
  returnDaysLeft?: number | null; returnRequested?: boolean; guest?: boolean;
};

const greeting: ChatMessage = { role: "assistant", text: "" };
const STORE_KEY = "smp_chat_v2";
/** Tab bar placement (reviewed both at 360px): on top it keeps the input as the main action. */
const TABS_ON_TOP = true;
const tabSkeleton = () => <div className="space-y-2.5 p-3.5">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-co-panel" />)}</div>;
const ShopTab = dynamic(() => import("@/components/chat/tabs/ShopTab"), { loading: tabSkeleton });
const OrdersTab = dynamic(() => import("@/components/chat/tabs/OrdersTab"), { loading: tabSkeleton });
const HelpTab = dynamic(() => import("@/components/chat/tabs/HelpTab"), { loading: tabSkeleton });

type Saved = { messages: ChatMessage[]; tab: ChatTab; language: ChatLanguage };
/** Conversation, tab and language survive reloads and the login redirect (this browser only). */
function loadSaved(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    const messages = Array.isArray(saved.messages) && saved.messages.length ? saved.messages : [greeting];
    return { messages, tab: saved.tab ?? "chat", language: saved.language ?? "auto" };
  } catch {
    return null;
  }
}
function persist(state: Saved) {
  try {
    const body = state.messages
      .slice(1)
      .filter((message) => !message.streaming)
      .slice(-40)
      // An add-to-cart that already ran must never run again after a reload.
      .map((message) => (message.cart?.action === "add" ? { ...message, cart: { ...message.cart, done: true } } : message));
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, messages: [greeting, ...body] }));
  } catch { /* storage full or blocked */ }
}
/** Every [[…]] action marker, plus a half-streamed one at the very end. */
const clean = (text: string) => text.replace(/\s*\[\[[^\]]*\]\]\s*/g, " ").replace(/\[\[[^\]]*$/, "").replace(/ +\n/g, "\n").trim();
const NUDGE_KEY = "smp_chat_nudged";
const RESUME_KEY = "smp_chat_resume";
const STATUS_TEXT: Record<string, string> = {
  pending_payment: "payment ke intezaar mein", payment_failed: "payment fail hone ki wajah se ruka hua", paid: "confirm ho gaya hai",
  cod_pending: "confirm ho gaya hai (COD)", confirmed: "confirm ho gaya hai", packed: "pack ho chuka hai", shipped: "raste mein hai 🚚",
  delivered: "deliver ho chuka hai ✅", cancelled: "cancel ho chuka hai", rto: "wapas hamare paas aa raha hai", refunded: "refund ho chuka hai",
  partially_refunded: "partial refund ho chuka hai",
};
const INTENT_ASK: Record<Intent, string> = { track: "Mera order kahan hai?", cancel: "Mujhe order cancel karna hai", refund: "Mera refund status batao", return: "Order mein problem hai, return karna hai" };
const ACTIVE = ["pending_payment", "paid", "cod_pending", "confirmed", "packed", "shipped"];

/** Plain-language summary of one order for the chosen intent; paragraphs become separate bubbles. */
function orderSummary(order: OrderDetail, intent: Intent) {
  const parts = [`Aapka order **${order.orderNo}** ${STATUS_TEXT[order.status] ?? order.status.replaceAll("_", " ")}.`];
  const eta = order.tracking?.expectedDelivery ?? order.eta;
  const courier = order.tracking?.courier ?? order.courier;
  if (order.status === "shipped" && (eta || courier)) parts.push([courier && `Courier: **${courier}**`, eta && `Expected delivery: **${eta}**`].filter(Boolean).join(" · "));
  const rule = order.canCancel ?? order.cancelRule;
  if (intent === "cancel") {
    if (rule?.ok) parts.push("Yeh order abhi cancel ho sakta hai. Neeche reason chun ke confirm kar dijiye.");
    else if (order.status === "paid" || (rule && !rule.ok && rule.canRequest)) parts.push("Aapne online payment kiya hai, isliye cancel hamari team karegi aur **poora refund** milega. Neeche se request bhej dijiye. 🙏");
    else if (order.status === "cancelled") parts.push("Yeh order pehle hi cancel ho chuka hai.");
    else if (["cod_pending", "confirmed", "packed", "pending_payment"].includes(order.status)) parts.push("Is order ki **shipment ban chuki hai** (courier book ho gaya hai), isliye ab yahan se cancel nahi ho sakta. Zarurat ho toh neeche se hamari team se baat kar lijiye. 🙏");
    else parts.push("Order dispatch ho chuka hai, isliye ab cancel nahi ho sakta. Delivery ke baad zarurat ho toh return request kar sakte hain.");
  }
  if (intent === "refund") {
    const refund = order.refunds?.[0];
    parts.push(refund
      ? `Refund **₹${refund.amount}** ka status: **${refund.status.replaceAll("_", " ")}**. Bank mein aane mein 5–7 working days lag sakte hain.`
      : "Is order par abhi koi refund nahi hai.\n\nRefund ya replacement tab milta hai jab product **damaged / leaking** ya **expired** pahunche, ya prepaid order dispatch se pehle cancel ho. Aisa hua hai toh photo ke saath request bhejiye.");
  }
  if (intent === "return") parts.push(order.returnRequested ? "Is order ka return request already khula hai, team jaldi update degi." : order.returnDaysLeft != null && order.returnDaysLeft > 0 ? `Return window mein **${order.returnDaysLeft} din** baaki hain. Neeche se request kar sakte hain.` : "Is order par return window abhi available nahi hai. Team se baat karni ho toh neeche button hai.");
  return parts.join("\n\n");
}
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replaceAll("-", "").slice(0, 20) : Math.random().toString(36).slice(2, 14));
const ORDER_MARKER = /\[\[orders:(track|cancel|refund|return)\]\]/;

/** "Show my orders / order history" style asks: show the list instead of opening one order. */
const LIST_WORDS = /\b(k(a|o)u?nsa (wala |vala )?order|which order|my orders|mere orders|meri orders|sab(hi)? orders?|all (my )?orders|order history|past orders?|previous orders?|old orders?|pichh?le orders?|purane orders?|orders dikha\w*|orders batao)\b|पिछले ऑर्डर|पुराने ऑर्डर|सारे ऑर्डर|ऑर्डर दिखाओ/i;

function intentFor(text: string): Intent {
  if (/cancel|radd/i.test(text)) return "cancel";
  if (/refund|paise|money back/i.test(text)) return "refund";
  if (/return|damaged?|leak|toot|tut|broken|kharab|galat|wrong item|missing/i.test(text)) return "return";
  return "track";
}

/** Card numbers (Luhn), CVV / UPI PIN / OTP shared as text: blocked before sending. */
function looksLikePaymentSecret(text: string) {
  const digits = text.replace(/[\s-]/g, "");
  const card = /\d{13,19}/.exec(digits)?.[0];
  if (card) {
    let sum = 0;
    for (let i = 0; i < card.length; i++) {
      let d = Number(card[card.length - 1 - i]);
      if (i % 2) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    if (sum % 10 === 0) return true;
  }
  return /\b(otp|cvv|cvc|upi\s*pin|atm\s*pin|pin)\b[^\d]{0,20}\d{3,6}\b|\b\d{3,6}\b[^\d]{0,12}\b(otp|cvv|upi\s*pin|pin)\b/i.test(text);
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  // Phones get a full-screen sheet (max-sm), so it slides up instead of scaling from the corner.
  const phone = useIsMobile();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSaved()?.messages ?? [greeting]);
  // Always the latest conversation: voice callbacks (mic result, hands-free re-listen) are created
  // earlier and would otherwise send a stale history, so the bot "forgot" what was just discussed.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [tab, setTab] = useState<ChatTab>(() => loadSaved()?.tab ?? "chat");
  const [language, setLanguage] = useState<ChatLanguage>(() => loadSaved()?.language ?? "auto");
  const [catalog, setCatalog] = useState<ShopProduct[] | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [labelHidden, setLabelHidden] = useState(false);
  // The "Need help? Chat with me" pill slides out from the avatar ~12s after landing, not on load.
  const [labelReady, setLabelReady] = useState(false);
  // Like Two Brothers: it stays ~8s, then tucks itself back in; hovering the avatar peeks it again.
  const [labelPeek, setLabelPeek] = useState(false);
  useEffect(() => {
    const show = setTimeout(() => setLabelReady(true), 12000);
    const hide = setTimeout(() => setLabelHidden(true), 20000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);
  const [viewportBox, setViewportBox] = useState<{ height: number; top: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const { cart, refresh: refreshCart, isOpen: cartDrawerOpen } = useCart();
  // The site cart drawer and the chat must never stack: opening the drawer (from the chat's
  // "Cart kholein" or the page header) closes the chat; the conversation is kept.
  useEffect(() => {
    if (cartDrawerOpen) setOpen(false);
  }, [cartDrawerOpen]);
  const [sheetRoot, setSheetRoot] = useState<HTMLElement | null>(null);
  const [listening, setListening] = useState(false);
  // Voice mode: the shopper spoke, so replies are read aloud (Dadi ji's voice) and the mic re-opens after.
  const voiceModeRef = useRef(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const voiceOk = typeof window !== "undefined" && canSpeak();

  /** Read one reply aloud; in voice mode, listen again when it ends. */
  async function readAloud(key: string, text: string, langHint: string, thenListen = false) {
    setSpeakingKey(key);
    await speak(text, langOf(language, langHint));
    setSpeakingKey((k) => (k === key ? null : k));
    if (thenListen && voiceModeRef.current) startVoice(true);
  }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [nudge, setNudge] = useState(false);

  // One gentle "need help?" bubble per browser session, a few seconds after landing.
  useEffect(() => {
    let seen = true;
    try { seen = sessionStorage.getItem(NUDGE_KEY) === "1"; } catch { /* storage blocked */ }
    if (seen) return;
    const timer = setTimeout(() => setNudge(true), 35000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    persist({ messages, tab, language });
  }, [messages, tab, language]);

  // Context for the welcome card: the product on this page, or a live order to show first.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    if (pathname.startsWith("/products/") && !catalog) {
      fetch("/api/chat/catalog").then((response) => response.json()).then((data: { products: ShopProduct[] }) => alive && setCatalog(data.products)).catch(() => undefined);
    }
    fetch("/api/chat/orders", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean; orders?: Order[] }) => alive && setActiveOrder(data.authenticated ? data.orders?.find((order) => ACTIVE.includes(order.status)) ?? null : null))
      .catch(() => undefined);
    return () => { alive = false; };
  }, [open, pathname, catalog]);

  // Close with Esc or a click outside the panel (desktop). Menus portalled out of the panel are ignored.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('[role="menu"]')) return;
      toggle(false);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || panelRef.current?.contains(target) || launcherRef.current?.contains(target)) return;
      if (target.closest('[data-chat-keep], [role="menu"], [data-radix-popper-content-wrapper], [data-sonner-toaster]')) return;
      if (window.matchMedia("(max-width: 639px)").matches) return;
      toggle(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle only touches state setters
  }, [open]);

  // Phones: size the sheet to the visual viewport so the input stays above the keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport || !window.matchMedia("(max-width: 639px)").matches) return;
    // When the keyboard opens the browser may also scroll the visual viewport down (offsetTop > 0);
    // follow it so the header stays visible and the page never shows under the sheet.
    const update = () => setViewportBox({ height: Math.round(viewport.height), top: Math.max(0, Math.round(viewport.offsetTop)) });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => { viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update); setViewportBox(null); };
  }, [open]);

  // Full-screen sheet on phones: stop the page behind it from scrolling.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) return;
    lockScroll();
    return () => unlockScroll();
  }, [open]);

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) {
      voiceModeRef.current = false;
      recognitionRef.current?.stop();
      stopSpeaking();
      setSpeakingKey(null);
    }
    if (!next) requestAnimationFrame(() => launcherRef.current?.focus());
    if (next || nudge) {
      setNudge(false);
      try { sessionStorage.setItem(NUDGE_KEY, "1"); } catch { /* storage blocked */ }
    }
  }

  function say(text: string, extra: Partial<ChatMessage> = {}) {
    setMessages((current) => [...current, { role: "assistant", text, ...extra }]);
  }

  /** One order as blocks: plain summary, animated status card, and the action the intent needs. */
  async function loadOrderDetail(order: Order, intent: Intent = "track") {
    setBusy(true);
    try {
      const response = await fetch(`/api/chat/orders?orderId=${order.id}`, { cache: "no-store" });
      const data = await readJson<{ order?: OrderDetail; error?: string }>(response);
      if (response.status === 401) { say("Is order ke liye pehle login kar lijiye 🔐", { blocks: [{ type: "login_card", intent }] }); return; }
      if (!response.ok || !data.order) throw new Error(data.error || "Order load nahi ho paaya.");
      const detail = data.order;
      const rule = detail.canCancel ?? detail.cancelRule;
      const blocks: ChatBlock[] = [{
        type: "order_status",
        intent,
        order: {
          id: detail.id, orderNo: detail.orderNo, status: detail.status, createdAt: detail.createdAt, method: detail.method,
          eta: detail.tracking?.expectedDelivery ?? detail.eta ?? null, courier: detail.tracking?.courier ?? detail.courier ?? null,
          awb: detail.tracking?.awb ?? detail.awb ?? null, trackingUrl: detail.tracking?.trackingUrl ?? detail.trackingUrl ?? null,
          events: detail.tracking?.events ?? [], refunds: (detail.refunds ?? []).map(({ amount, status, at }) => ({ amount, status, at })),
        },
      }];
      if (intent === "cancel" && rule?.ok && !detail.guest) {
        blocks.push({ type: "action_confirm", kind: "cancel", orderId: detail.id, orderNo: detail.orderNo, summary: `Order ${detail.orderNo} abhi cancel ho jayega.`, consequences: ["Yeh wapas nahi hoga", detail.method === "cod" ? "COD order hai, koi payment nahi kata" : "Payment ka poora refund original method mein aayega"] });
      } else if (intent === "cancel" && (detail.status === "paid" || (rule && !rule.ok && rule.canRequest))) {
        blocks.push({ type: "action_confirm", kind: "cancel_request", orderId: detail.id, orderNo: detail.orderNo, summary: "Online payment wala order hamari team cancel karti hai.", consequences: ["Team request dekh ke order cancel karegi", "Poora refund original payment method mein 5–7 working days mein"] });
      } else if (intent === "cancel" && !rule?.ok && detail.status !== "cancelled") {
        blocks.push({ type: "quick_replies", options: ["Return kaise karein?", "Team se baat karni hai"] });
      } else if (intent === "return" && detail.status === "delivered" && !detail.returnRequested) {
        blocks.push({ type: "action_confirm", kind: "return", orderId: detail.id, orderNo: detail.orderNo, summary: "Damaged, leaking, expired ya galat item ke liye return / replacement request.", consequences: ["Photo ke saath request bhejni hogi", "Khula ya use kiya product sirf damage/expiry pe hi"] });
      }
      say(orderSummary(detail, intent), { key: newKey(), blocks });
    } catch (error) {
      say(error instanceof Error ? error.message : "Order load nahi ho paaya.", { blocks: [{ type: "notice", tone: "error", text: "Network issue. Thodi der baad dobara try karein." }] });
    } finally {
      setBusy(false);
    }
  }

  /** Order help: track opens the latest active order; other actions ask which order when there are several. */
  async function loadOrders(intent: Intent = "track", asList = false) {
    setBusy(true);
    try {
      const response = await fetch("/api/chat/orders", { cache: "no-store" });
      const data = await readJson<{ authenticated?: boolean; orders?: Order[]; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Orders load nahi ho paaye.");
      const list = data.orders ?? [];
      if (!data.authenticated && !list.length) {
        say("Order ki details ke liye pehle login kar lijiye 🔐\n\nLogin ke baad main khud aapka order check karke bata dunga.", { blocks: [{ type: "login_card", intent }] });
        return;
      }
      if (!list.length) {
        say("Aapke account mein abhi koi order nahi hai. 🛒", { blocks: [{ type: "quick_replies", options: ["Tel chunne mein madad", "Bestsellers dikhao"] }] });
        return;
      }
      if (asList && list.length > 1) {
        say(`Yeh rahe aapke orders (${list.length}). Kisi pe tap karke status, cancel ya return dekhiye. 👇`, { blocks: [{ type: "order_list", intent, orders: list.slice(0, 8) }] });
        return;
      }
      if (intent !== "track" && list.length > 1) {
        say("Kaunsa order?", { blocks: [{ type: "order_list", intent, orders: list.slice(0, 8) }] });
        return;
      }
      // Tracking with several live orders: let the shopper pick instead of guessing one.
      const active = list.filter((order) => ACTIVE.includes(order.status));
      if (intent === "track" && active.length > 1) {
        const rest = list.filter((order) => !ACTIVE.includes(order.status));
        say(`Aapke **${active.length} orders** abhi chal rahe hain. Kaunsa dekhna hai? 👇`, { blocks: [{ type: "order_list", intent, orders: [...active, ...rest].slice(0, 8) }] });
        return;
      }
      const pick = active[0] ?? list[0];
      setBusy(false);
      await loadOrderDetail(pick, intent);
    } catch (error) {
      say(error instanceof Error ? error.message : "Orders load nahi ho paaye.", { blocks: [{ type: "notice", tone: "error", text: "Network issue. Dobara try karein." }] });
    } finally {
      setBusy(false);
    }
  }

  function goLogin(intent: Intent | "checkout") {
    try { sessionStorage.setItem(RESUME_KEY, intent); } catch { /* storage blocked */ }
    setOpen(false);
    router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }

  // Back from login (client navigation keeps this widget mounted, so watch the path):
  // reopen the chat and finish the order check the shopper started.
  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    let intent: string | null = null;
    try { intent = sessionStorage.getItem(RESUME_KEY); if (intent) sessionStorage.removeItem(RESUME_KEY); } catch { /* storage blocked */ }
    // Back from the PayU page: show how the payment went, with the cart still intact on failure.
    let paid: { orderId: number; orderNo: string } | null = null;
    try { const raw = sessionStorage.getItem(PAY_RESUME_KEY); if (raw) { paid = JSON.parse(raw); sessionStorage.removeItem(PAY_RESUME_KEY); } } catch { /* storage blocked */ }
    if (paid) {
      const order = paid;
      const timer = setTimeout(() => { setOpen(true); setTab("chat"); void resumeAfterPayment(order); }, 400);
      return () => clearTimeout(timer);
    }
    if (intent === "checkout") {
      const timer = setTimeout(() => { setOpen(true); setTab("chat"); say("Chaliye, checkout poora karte hain 👇 Aapka cart wahi hai.", { key: newKey(), blocks: [{ type: "checkout_card" }] }); }, 400);
      return () => clearTimeout(timer);
    }
    if (!intent || !["track", "cancel", "refund", "return"].includes(intent)) return;
    const timer = setTimeout(() => {
      setOpen(true);
      void loadOrders(intent as Intent);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadOrders is recreated each render; only the path matters
  }, [pathname]);

  async function resumeAfterPayment(order: { orderId: number; orderNo: string }) {
    const response = await fetch(`/api/chat/orders?orderId=${order.orderId}`, { cache: "no-store" }).catch(() => null);
    const data = response?.ok ? await readJson<{ order?: OrderDetail }>(response) : null;
    const status = data?.order?.status;
    if (status && !["pending_payment", "payment_failed"].includes(status)) {
      say(`Payment ho gaya! Order **${order.orderNo}** confirm hai. 🎉`, { key: newKey(), blocks: [{ type: "notice", tone: "success", text: "Order confirm. Email/WhatsApp par update aayega." }] });
      await loadOrderDetail({ id: order.orderId, orderNo: order.orderNo, status, createdAt: data!.order!.createdAt }, "track");
      return;
    }
    await refreshCart();
    say(`Order **${order.orderNo}** ka payment poora nahi hua. Aapka cart wahi hai.`, {
      key: newKey(),
      blocks: [
        { type: "notice", tone: "error", text: "Payment cancel ya fail ho gaya. Paise kate hon toh 5–7 din mein wapas aa jaate hain." },
        { type: "quick_replies", options: ["Checkout dobara kholo", "COD se order karein"] },
      ],
    });
  }

  /** Same items and sizes at today's prices; shows what changed, then the cart (never straight to payment). */
  async function reorder(orderId: number, orderNo: string) {
    setTab("chat");
    setMessages((current) => [...current, { role: "user", text: `${orderNo} dobara mangwa do` }]);
    setBusy(true);
    try {
      const result = await reorderAction(orderId);
      await refreshCart();
      const notes: ChatBlock[] = [];
      if (result.skipped.length) notes.push({ type: "notice", tone: "warning", text: `Stock mein nahi: ${result.skipped.join(", ")}` });
      if (result.repriced.length) notes.push({ type: "notice", tone: "warning", text: `Daam badla: ${result.repriced.map((item) => `${item.item} ₹${item.was} → ₹${item.now}`).join("; ")}` });
      say(result.added ? `${result.added} item cart mein daal diye, aaj ke daam par. 🛒` : "Is order ka koi item abhi available nahi hai.", { key: newKey(), blocks: [...notes, ...(result.added ? [{ type: "cart_summary" } as ChatBlock] : [])] });
    } catch {
      say("Reorder ke liye pehle login kijiye.", { blocks: [{ type: "login_card", intent: "track" }] });
    } finally {
      setBusy(false);
    }
  }

  async function reorderLatest() {
    const response = await fetch("/api/chat/orders", { cache: "no-store" }).catch(() => null);
    const data = response?.ok ? await readJson<{ authenticated?: boolean; orders?: Order[] }>(response) : null;
    if (!data?.authenticated) { say("Pichhla order dekhne ke liye login kijiye 🔐", { blocks: [{ type: "login_card", intent: "track" }] }); return; }
    const latest = data.orders?.find((order) => !["pending_payment", "payment_failed"].includes(order.status));
    if (!latest) { say("Abhi tak koi pura hua order nahi mila."); return; }
    await reorder(latest.id, latest.orderNo);
  }

  function patchLast(patch: (message: ChatMessage) => ChatMessage) {
    setMessages((current) => [...current.slice(0, -1), patch(current[current.length - 1])]);
  }

  async function submitQuestion(text: string, opts: { voice?: boolean } = {}) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    // A new question cuts the current reading; typing (not speaking) leaves voice mode.
    stopSpeaking();
    setSpeakingKey(null);
    if (!opts.voice) voiceModeRef.current = false;
    if (looksLikePaymentSecret(trimmed)) {
      // Never sent to the server, Gemini or the transcript.
      setInput("");
      setTab("chat");
      say("⚠️ Card number, CVV, UPI PIN ya OTP kabhi chat mein mat likhiye. Payment sirf PayU ke secure page par hota hai, aur hamari team bhi yeh kabhi nahi maangti.", { blocks: [{ type: "notice", tone: "warning", text: "Aapka message bheja nahi gaya." }] });
      return;
    }
    setTab("chat");
    sessionRef.current ??= newKey();
    const msgKey = newKey();
    // Assistant turns go back with the server's signature (unsigned ones are ignored by the server).
    const history = messagesRef.current
      .slice(1)
      .filter((message) => message.text && (message.role === "user" || message.sig))
      .map(({ role, text: body, turn, sig }) => (role === "assistant" ? { role, text: (turn ?? body).slice(0, 2000), sig } : { role, text: body.slice(0, 2000) }))
      .slice(-8);
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    // Spoken question and the answer takes a moment: say a short "जी, देखती हूँ…" so it never feels dead.
    let fillerTimer: ReturnType<typeof setTimeout> | null = opts.voice ? setTimeout(() => speakFiller(langOf(language, trimmed)), 700) : null;
    const stopFiller = () => {
      if (fillerTimer) clearTimeout(fillerTimer);
      fillerTimer = null;
    };
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history, sessionId: sessionRef.current, msgKey, ...(language !== "auto" ? { language } : {}), ...(opts.voice ? { voice: true } : {}) }),
      });
      if (response.headers.get("content-type")?.includes("ndjson") && response.body) {
        setMessages((current) => [...current, { role: "assistant", text: "", key: msgKey, streaming: true }]);
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let full = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as { type: string; delta?: string; sources?: Source[]; products?: ShopProduct[]; turn?: string; sig?: string } & Partial<CartIntent>;
            if (event.type === "done" && event.sig) patchLast((message) => ({ ...message, turn: event.turn, sig: event.sig }));
            if (event.type === "action" && event.action) {
              const { type: _type, ...cart } = event;
              void _type;
              patchLast((message) => ({ ...message, cart: cart as CartIntent, ...(cart.action === "add" ? { products: [] } : {}) }));
            }
            if (event.type === "meta") patchLast((message) => ({ ...message, sources: event.sources, products: event.products }));
            if (event.type === "blocks") patchLast((message) => ({ ...message, blocks: parseBlocks((event as unknown as { blocks: unknown }).blocks) }));
            if (event.type === "options" && Array.isArray((event as { options?: unknown }).options)) patchLast((message) => ({ ...message, options: (event as unknown as { options: string[] }).options }));
            if (event.type === "products" && event.products?.length) patchLast((message) => (message.cart?.action === "add" ? message : { ...message, products: event.products }));
            if (event.type === "text" && event.delta) {
              stopFiller();
              full += event.delta;
              const visible = clean(full);
              patchLast((message) => ({ ...message, text: visible }));
            }
          }
        }
        const intent = full.match(ORDER_MARKER)?.[1] as Intent | undefined;
        // Asked by voice: Dadi ji reads the answer out, then the mic listens again.
        if (opts.voice && clean(full)) void readAloud(msgKey, clean(full), trimmed, !intent);
        patchLast((message) => ({
          ...message,
          streaming: false,
          text: clean(full) || lineFor(language, trimmed, {
            en: "Sorry, I couldn't get an answer just now. Please ask again, or message the team on WhatsApp.",
            hinglish: "Maaf kijiye, abhi jawab nahi mil paaya. Please dobara poochiye ya WhatsApp par team se baat kijiye.",
            hi: "माफ़ कीजिए, अभी जवाब नहीं मिल पाया। कृपया दोबारा पूछें या WhatsApp पर टीम से बात करें।",
          }),
          ...(intent ? { sources: [], products: [] } : {}),
        }));
        if (intent) await loadOrders(intent, LIST_WORDS.test(trimmed));
        return;
      }
      const data = await readJson<{ answer?: string; sources?: Source[]; suggestions?: Suggestion[]; products?: ShopProduct[]; action?: string; cartAction?: "cart" | "checkout"; blocks?: unknown; error?: string; turn?: string; sig?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Please try again.");
      setMessages((current) => [...current, { role: "assistant", key: msgKey, turn: data.turn, sig: data.sig, text: data.answer ?? "I couldn't find an answer.", sources: data.sources, suggestions: data.suggestions, products: data.products, ...(data.cartAction ? { cart: { action: data.cartAction } } : {}), blocks: parseBlocks(data.blocks) }]);
      if (opts.voice && data.answer) void readAloud(msgKey, data.answer, trimmed, !data.action);
      if (data.action === "orders") await loadOrders(intentFor(trimmed), LIST_WORDS.test(trimmed));
      if (data.action === "reorder") await reorderLatest();
    } catch (error) {
      setMessages((current) => [...current.filter((message) => !(message.streaming && !message.text)), { role: "assistant", text: error instanceof Error && error.message && !/fetch|network|load failed/i.test(error.message) ? error.message : lineFor(language, trimmed, {
        en: "Couldn't send that. Please check your internet and try again.",
        hinglish: "Message nahi ja paaya. Internet check karke dobara bhejiye.",
        hi: "मैसेज नहीं जा पाया। इंटरनेट देखकर फिर से भेजें।",
      }) }]);
    } finally {
      stopFiller();
      setBusy(false);
    }
  }

  async function sendFeedback(message: ChatMessage, value: 1 | -1) {
    if (!message.key || message.feedback) return;
    setMessages((current) => current.map((item) => item.key === message.key ? { ...item, feedback: value } : item));
    if (value === -1) say("Maaf kijiye, jawab theek nahi tha. Hamari team se seedha baat kar sakte hain:", { blocks: [{ type: "handoff" }] });
    await fetch("/api/chat/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ msgKey: message.key, sessionId: sessionRef.current, value }) }).catch(() => undefined);
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.text.replaceAll("**", ""));
      setCopied(message.key ?? null);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked */ }
  }

  /** Orders tab / context card: open one order in the conversation for the chosen action. */
  function openOrder(order: Order, intent: Intent, all: Order[] = [order]) {
    setTab("chat");
    setMessages((current) => [...current, { role: "user", text: `${INTENT_ASK[intent]} (${order.orderNo})` }]);
    void all;
    void loadOrderDetail(order, intent);
  }

  function askOrders(intent: Intent) {
    setTab("chat");
    setMessages((current) => [...current, { role: "user", text: INTENT_ASK[intent] }]);
    void loadOrders(intent);
  }

  function addProduct(product: ShopProduct) {
    setTab("chat");
    setMessages((current) => [
      ...current,
      { role: "user", text: `${product.title} cart mein daalo` },
      { role: "assistant", key: newKey(), text: "Kaunsa size chahiye? Neeche se chun lijiye 👇", cart: { action: "add", product, variantId: null, qty: 1 } },
    ]);
  }

  function showCart() {
    setTab("chat");
    setMessages((current) => [...current, { role: "assistant", key: newKey(), text: "Yeh raha aapka cart 🛒", cart: { action: "cart" } }]);
  }

  function resetChat() {
    setTab("chat");
    sessionRef.current = null;
    setMessages([greeting]);
  }

  const Speech = typeof window !== "undefined"
    ? ((window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition)
    : undefined;

  function startVoice(auto = false) {
    if (!Speech) return;
    // Tapping the mic while it listens turns voice mode off.
    if (listening) {
      voiceModeRef.current = false;
      recognitionRef.current?.stop();
      return;
    }
    stopSpeaking();
    setSpeakingKey(null);
    voiceModeRef.current = true;
    // This tap is the user gesture mobile browsers need before the reply can be spoken later.
    if (!auto) primeSpeech();
    const recognition = new Speech();
    recognitionRef.current = recognition as unknown as { stop: () => void };
    // The language menu decides: English → en-IN, otherwise Hindi voice (it also hears Hinglish).
    recognition.lang = language === "English" ? "en-IN" : "hi-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) void submitQuestion(transcript, { voice: true });
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") say("Mic ki permission nahi mili 🎙️\n\nBrowser ke address bar mein mic icon par click karke **Allow** kijiye, phir dobara try kijiye.");
      // Hands-free re-listen that hears nothing: just end voice mode quietly (no nagging message).
      else if (event.error === "no-speech") { voiceModeRef.current = false; if (!auto) say("Kuch sunai nahi diya. Mic button dabake dobara boliye. 🙂"); }
      else if (event.error !== "aborted") say("Voice abhi kaam nahi kar raha. Please type karke poochiye.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  function resolveAction(block: ChatBlockOf<"action_confirm">, resolved: "confirmed" | "dismissed") {
    setMessages((current) => current.map((message) => (message.blocks?.includes(block) ? { ...message, blocks: message.blocks.map((item) => (item === block ? { ...block, resolved } : item)) } : message)));
  }

  const blockHandlers: BlockHandlers = {
    sheetRoot,
    onCheckoutLogin: () => goLogin("checkout"),
    onPlaced: (result) => {
      say(`Order **${result.orderNo}** place ho gaya! 🎉`, { key: newKey(), blocks: [{ type: "notice", tone: "success", text: "Cash on delivery order confirm. Email/WhatsApp par update aayega." }] });
      void loadOrderDetail({ id: result.orderId, orderNo: result.orderNo, status: "cod_pending", createdAt: new Date().toISOString() }, "track");
    },
    onAsk: (text) => void submitQuestion(text),
    onLogin: (intent) => goLogin(intent),
    onOpenOrder: (order, intent) => openOrder(order as Order, intent),
    onDismiss: (block) => resolveAction(block, "dismissed"),
    onConfirm: async (block, reason, extras) => {
      if (block.kind === "cancel") {
        const result = await cancelMyOrderAction({ orderId: block.orderId, reason });
        if (!result.ok) {
          say(result.error, { blocks: [{ type: "notice", tone: "error", text: result.error }] });
          throw new Error(result.error);
        }
        resolveAction(block, "confirmed");
        say(`Order **${block.orderNo}** cancel ho gaya. ✅\n\nEmail/WhatsApp par confirmation bhi aa jayega.`);
        return;
      }
      if (block.kind === "cancel_request") {
        // Same path as the order page: help ticket + team alert + "needs attention" flag on the admin order.
        const result = await requestCancelOrderAction({ orderId: block.orderId, reason: "Other" });
        if (!result.ok) { say(result.error, { blocks: [{ type: "notice", tone: "error", text: result.error }] }); throw new Error(result.error); }
        resolveAction(block, "confirmed");
        say(`Cancel request bhej di. Reference: **${result.ticketNo}**`, { key: newKey(), blocks: [{ type: "notice", tone: "success", text: "Team order cancel karke poora refund karegi. Jaldi chahiye toh WhatsApp karein." }, { type: "handoff", reason: "Turant baat karni ho toh:" }] });
        return;
      }
      // Return: the existing return request (all items), plus a photo ticket when photos were added.
      const response = await fetch(`/api/chat/orders?orderId=${block.orderId}`, { cache: "no-store" });
      const data = await readJson<{ order?: OrderDetail & { items?: { variantKey: string; qty: number }[] } }>(response);
      const items = data.order?.items ?? [];
      if (!items.length) throw new Error("no items");
      const expired = reason === RETURN_CHOICES[1];
      const returnReason = expired ? "Other" : (reason as "Damaged or leaking" | "Wrong item received" | "Item missing" | "Quality not as expected");
      const note = [expired ? "Expired on arrival." : "", extras?.note ?? ""].filter(Boolean).join(" ").slice(0, 500) || undefined;
      const result = await requestReturnAction({ orderId: block.orderId, items: items.map((item) => ({ variantKey: item.variantKey, qty: item.qty })), reason: returnReason, ...(note ? { note } : {}) });
      if (!result.ok) { say(result.error, { blocks: [{ type: "notice", tone: "error", text: result.error }, { type: "handoff" }] }); throw new Error(result.error); }
      let reference = "";
      if (extras?.photos?.length) {
        const issue = reason === "Wrong item received" ? "wrong_item" : reason === "Item missing" ? "missing_item" : reason === "Quality not as expected" || expired ? "quality" : "damaged";
        const ticket = await submitSupportTicketAction({ orderId: block.orderId, issue, message: note ?? reason, contactPref: "whatsapp", photos: extras.photos });
        if (ticket.ok) reference = ticket.ticket.ticketNo;
      }
      resolveAction(block, "confirmed");
      say(`Return request bhej di${reference ? `. Reference: **${reference}**` : ""}.`, { key: newKey(), blocks: [{ type: "notice", tone: "success", text: "Team photo dekh kar replacement ya refund karegi." }, { type: "handoff", reason: "Jaldi baat karni ho toh:" }] });
    },
  };

  const last = messages[messages.length - 1];
  const thinking = busy && !(last?.role === "assistant" && last.streaming && last.text);
  const welcome = messages.length === 1 && !busy;
  const iconBtn = "grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-co-panel hover:text-forest";
  const scrollArea = "overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_14px,#000_calc(100%-14px),transparent)] [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(7,47,27,.22)_transparent]";
  const cartCount = cart?.totalQuantity ?? 0;
  const pageProduct = pathname.startsWith("/products/") ? catalog?.find((product) => product.href === pathname) : undefined;
  const onCartPage = /^\/(cart|checkout)/.test(pathname);
  const context: WelcomeContext = activeOrder
    ? { kind: "order", orderNo: activeOrder.orderNo, status: activeOrder.status, eta: activeOrder.eta, onOpen: () => openOrder(activeOrder, "track") }
    : pageProduct
      ? { kind: "product", product: pageProduct }
      : cartCount
        ? { kind: "cart", count: cartCount, subtotal: Number(cart?.subtotal.amount ?? 0) }
        : { kind: "none" };
  const ask = (text: string) => () => void submitQuestion(text);
  const contextChips: Chip[] = pageProduct
    ? [
        { label: "Iske fayde?", icon: CHIP_ICONS.Leaf, run: ask(`${pageProduct.title} ke fayde kya hain?`) },
        { label: "Kaise use karein?", icon: CHIP_ICONS.HelpCircle, run: ask(`${pageProduct.title} kaise use karein?`) },
        { label: "Kaunsa size lun?", icon: CHIP_ICONS.Ruler, run: ask(`${pageProduct.title} ka kaunsa size lun?`) },
        { label: "Cart mein daalo", icon: CHIP_ICONS.ShoppingBag, run: () => addProduct(pageProduct) },
      ]
    : onCartPage
      ? [
          { label: "Checkout mein madad", icon: CHIP_ICONS.HelpCircle, run: ask("Checkout mein madad chahiye") },
          { label: "Free shipping kab?", icon: CHIP_ICONS.Truck, run: ask("Free shipping kab milti hai?") },
          { label: "Coupon hai?", icon: CHIP_ICONS.TicketPercent, run: ask("Koi coupon hai?") },
          { label: "COD hai?", icon: CHIP_ICONS.Banknote, run: ask("COD available hai?") },
        ]
      : [
          { label: "Tel chunne mein madad", icon: CHIP_ICONS.Droplets, run: ask("Mujhe sahi tel chunne mein madad chahiye") },
          { label: "Mera order kahan hai?", icon: CHIP_ICONS.Truck, run: () => askOrders("track") },
          { label: "COD available hai?", icon: CHIP_ICONS.Banknote, run: ask("COD available hai?") },
          { label: "Delivery kitne din mein?", icon: CHIP_ICONS.Clock, run: ask("Delivery kitne din mein hoti hai?") },
        ];
  // After the first message the chips shrink into one slim row: the latest reply's quick
  // replies when it has them, otherwise the contextual chips.
  const lastOptions = last?.role === "assistant" && !last.streaming ? (last.blocks?.find((block) => block.type === "quick_replies") as ChatBlockOf<"quick_replies"> | undefined)?.options ?? last.options : undefined;
  const chips: Chip[] = welcome ? contextChips : lastOptions?.length ? lastOptions.map((option) => ({ label: option, icon: CHIP_ICONS.ChevronRight, run: ask(option) })) : contextChips;

  const avatar = (
    <span className="relative mt-0.5 grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-line">
      <Image src="/logo.png" alt="" width={32} height={32} className="size-7 object-contain" />
    </span>
  );

  const conversation = (
    // Follow the conversation, but never scroll past the start of the latest step: the shopper's question,
    // or a new assistant step that followed another assistant message (order list → order status, tracking).
    // The answer then reads from its top instead of the view jumping down to the cards at the end.
    <ChatContainerRoot className={`relative h-full ${scrollArea}`} targetScrollTop={(target, { contentElement }) => {
      const questions = contentElement.querySelectorAll<HTMLElement>("[data-chat-anchor]");
      const last = questions[questions.length - 1];
      return last ? Math.min(target, Math.max(0, last.offsetTop - 12)) : target;
    }}>
      <ChatContainerContent className="space-y-4 px-3.5 py-4">
        {messages.slice(1).map((message, index, list) => (
          <motion.div
            data-chat-anchor={message.role === "user" || (index > 0 && list[index - 1].role === "assistant") ? "" : undefined}
            key={message.key ?? `${message.role}-${index}`} layout="position" initial="hidden" animate="show" variants={rise} style={{ transformOrigin: message.role === "user" ? "bottom right" : "top left" }}>
            {message.role === "user" ? (
              <div className={`ml-auto w-fit max-w-[82%] rounded-2xl rounded-br-md bg-forest px-3.5 py-2.5 text-white shadow-sm ${textClass(message.text)}`}>
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            ) : message.streaming && !message.text ? null : (
              <div className="flex gap-2">
                {avatar}
                <motion.div initial="hidden" animate="show" variants={staggerParent(0.06)} className="min-w-0 max-w-[88%] space-y-1.5">
                  {(() => {
                    const parts = message.text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
                    return parts.map((part, partIndex) => {
                      const lastPart = partIndex === parts.length - 1;
                      return (
                        <motion.div key={partIndex} variants={rise} className={`w-fit max-w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-ink shadow-[0_1px_2px_rgba(0,0,0,.04)] ${textClass(part)} ${partIndex === 0 ? "rounded-tl-md" : ""}`}>
                          <RichText text={part} />
                          {message.streaming && lastPart && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-forest/50" />}
                          {lastPart && message.login && (
                            <div className="mt-3 space-y-2">
                              <motion.button {...tap} type="button" onClick={() => goLogin(message.login!)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-forest-mid">
                                <ShieldCheck size={16} />Login karein
                              </motion.button>
                              <Link href="/track-order" className="block text-center text-[12.5px] font-semibold text-ink-muted underline underline-offset-2 hover:text-forest">Bina login ke, order number se track karein</Link>
                            </div>
                          )}
                          {lastPart && !message.streaming && <SourceLinks sources={message.sources ?? []} />}
                          {lastPart && !!message.suggestions?.length && <div className="mt-2 flex flex-wrap gap-2">{message.suggestions.map((suggestion) => suggestion.href ? <Link key={suggestion.label} href={suggestion.href} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-forest hover:bg-co-brand-soft">{suggestion.label}</Link> : null)}</div>}
                        </motion.div>
                      );
                    });
                  })()}
                  {!message.streaming && message.cart?.action === "add" && <div className="pt-1"><AddToCartCard intent={message.cart} actionKey={message.key ?? String(index)} /></div>}
                  {!message.streaming && message.cart && message.cart.action !== "add" && <div className="pt-1"><CartCard title={message.cart.action === "checkout" ? "Checkout se pehle ek nazar" : "Aapka cart"} /></div>}
                </motion.div>
              </div>
            )}
            {message.role === "assistant" && !message.streaming && !!message.products?.length && <ShopCards items={message.products.slice(0, 6)} />}
            {message.role === "assistant" && !message.streaming && !!message.blocks?.length && <BlockList blocks={message.blocks} handlers={blockHandlers} actionKey={message.key ?? String(index)} />}
            {message.role === "assistant" && !message.streaming && message.key && (
                    <div className="mt-1 flex items-center gap-0.5 pl-9">
                      {voiceOk && message.text && (
                        <motion.button
                          whileTap={{ scale: 0.9, transition: spring.press }}
                          type="button"
                          onClick={() => {
                            if (speakingKey === message.key) {
                              stopSpeaking();
                              setSpeakingKey(null);
                            } else {
                              primeSpeech();
                              void readAloud(message.key!, message.text, message.text);
                            }
                          }}
                          aria-label={speakingKey === message.key ? "Stop reading" : "Read aloud"}
                          title={speakingKey === message.key ? "Rokein" : "Sunein"}
                          className={`${iconBtn} ${speakingKey === message.key ? "text-forest" : ""}`}
                        >
                          {speakingKey === message.key ? <VolumeX size={14} className="animate-pulse" /> : <Volume2 size={14} />}
                        </motion.button>
                      )}
                      <motion.button whileTap={{ scale: 0.9, transition: spring.press }} type="button" onClick={() => void copyMessage(message)} aria-label="Copy answer" title="Copy" className={iconBtn}><AnimatePresence mode="wait" initial={false}>{copied === message.key ? <motion.span key="ok" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: spring.press }} exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }}><Check size={14} className="text-forest" /></motion.span> : <motion.span key="copy" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: spring.press }} exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }}><Copy size={14} /></motion.span>}</AnimatePresence></motion.button>
                      <motion.button whileTap={{ scale: 0.9, transition: spring.press }} type="button" onClick={() => void sendFeedback(message, 1)} aria-label="Helpful" title="Helpful" disabled={!!message.feedback} className={`${iconBtn} ${message.feedback === 1 ? "text-forest" : ""}`}><ThumbsUp size={14} fill={message.feedback === 1 ? "currentColor" : "none"} /></motion.button>
                      <motion.button whileTap={{ scale: 0.9, transition: spring.press }} type="button" onClick={() => void sendFeedback(message, -1)} aria-label="Not helpful" title="Not helpful" disabled={!!message.feedback} className={`${iconBtn} ${message.feedback === -1 ? "text-alert" : ""}`}><ThumbsDown size={14} fill={message.feedback === -1 ? "currentColor" : "none"} /></motion.button>
                      <AnimatePresence>{message.feedback && <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0, transition: small }} className="pl-1 text-[12.5px] text-ink-muted">{message.feedback === 1 ? "Dhanyavaad! 🙏" : "Thanks, team will improve this."}</motion.span>}</AnimatePresence>
                    </div>
                  )}
          </motion.div>
        ))}

                {thinking && <motion.div initial="hidden" animate="show" variants={rise} className="flex items-center gap-2">{avatar}<TypingWave /></motion.div>}
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
      <div className="pointer-events-none absolute bottom-3 right-3 [&>*]:pointer-events-auto">
        <ScrollButton className="size-9 rounded-full bg-white shadow-md" />
      </div>
    </ChatContainerRoot>
  );

  const body =
    tab === "shop" ? <ShopTab />
      : tab === "orders" ? <OrdersTab onAction={(order: OrderRow, action, all) => (action === "reorder" ? void reorder(order.id, order.orderNo) : openOrder(order, action, all))} onLogin={() => goLogin("track")} onShop={() => setTab("shop")} />
        : tab === "help" ? <HelpTab onAsk={(text) => void submitQuestion(text)} />
          : null;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className="chat-float fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-[80] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
          <AnimatePresence>
            {open && (
              <motion.section
                key="chat"
                ref={panelRef}
                role="dialog"
                aria-modal="false"
                aria-label="Mahadev Sahayak, shopping assistant"
                data-lenis-prevent
                // Transform + opacity only (GPU-cheap). No shared-layout morph with the launcher: on phones
                // the panel is full screen, and morphing the 56px photo up to that size was janky.
                initial={phone ? { opacity: 0, y: 40 } : { opacity: 0, scale: 0.94, y: 12 }}
                animate={phone ? { opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.outExpo } } : { opacity: 1, scale: 1, y: 0, transition: { duration: 0.26, ease: ease.outExpo } }}
                exit={phone ? { opacity: 0, y: 32, transition: { duration: 0.18, ease: ease.inQuart } } : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.16, ease: ease.inQuart } }}
                style={{ borderRadius: 20, transformOrigin: "bottom right", willChange: "transform, opacity", ...(viewportBox ? { height: viewportBox.height, top: viewportBox.top } : {}) }}
                className="relative flex h-[min(680px,calc(100vh-96px))] w-[420px] flex-col overflow-hidden border border-line bg-ivory shadow-[0_24px_80px_rgba(7,47,27,.28)] max-sm:shadow-none max-sm:fixed max-sm:inset-x-0 max-sm:top-0 max-sm:h-dvh max-sm:w-full max-sm:!rounded-none max-sm:border-0 max-sm:pt-[env(safe-area-inset-top)]"
              >
                <div ref={setSheetRoot} className="pointer-events-none absolute inset-0 z-30 [&>*]:pointer-events-auto" />
                <div className="flex h-full min-h-0 flex-col">
                  <ChatHeader
                    cartCount={cartCount}
                    language={language}
                    onCart={showCart}
                    onNewChat={resetChat}
                    onLanguage={setLanguage}
                    onOrders={() => setTab("orders")}
                    onClose={() => toggle(false)}
                  />

                  {TABS_ON_TOP && <ChatTabBar tab={tab} onChange={setTab} className="shrink-0 border-b border-line/70 bg-ivory px-1" />}

                  <div id="chat-tab-panel" role="tabpanel" aria-labelledby={`chat-tab-${tab}`} aria-live="polite" className="relative min-h-0 flex-1">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={tab === "chat" ? (welcome ? "welcome" : "chat") : tab} {...tabSwap} className="absolute inset-0">
                        {tab !== "chat" ? (
                          <div className={`h-full overflow-y-auto ${scrollArea}`}>{body}</div>
                        ) : welcome ? (
                          <div className={`h-full overflow-y-auto ${scrollArea}`}>
                            <ChatWelcome avatar={avatar} context={context} onAskProduct={(product) => void submitQuestion(`${product.title} ke baare mein batao`)} />
                          </div>
                        ) : conversation}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="shrink-0 space-y-2 bg-ivory px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2">
                    {tab === "chat" && <div className="pb-1"><ChipRow chips={chips} slim={!welcome} disabled={busy} /></div>}
                    {!TABS_ON_TOP && <ChatTabBar tab={tab} onChange={setTab} className="-mx-3 border-y border-line/70" />}
                    <PromptInput
                      value={input}
                      onValueChange={setInput}
                      onSubmit={() => void submitQuestion(input)}
                      isLoading={busy}
                      maxHeight={120}
                      className="flex items-end gap-1 rounded-[22px] border-line bg-white p-1 shadow-[0_2px_10px_rgba(7,47,27,.06)] transition-[border-color,box-shadow] focus-within:border-forest/40 focus-within:ring-2 focus-within:ring-forest/10"
                    >
                      <PromptInputTextarea placeholder={listening ? "Bol rahe hain… sun raha hoon" : "Kuch bhi poochiye…"} maxLength={500} aria-label="Your question" rows={1} className="min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[15px] leading-6 shadow-none placeholder:text-ink-muted focus-visible:ring-0 dark:bg-transparent" />
                      <PromptInputActions className="shrink-0 gap-0.5 pb-0.5 pr-0.5">
                        {Speech && (
                          <PromptInputAction tooltip="Bol kar poochiye (Hindi)">
                            <button type="button" onClick={() => startVoice()} aria-label={listening ? "Stop listening" : "Speak your question"} className={`grid size-10 place-items-center rounded-full transition-colors ${listening ? "animate-pulse bg-alert text-white" : "text-forest hover:bg-co-brand-soft"}`}><Mic size={18} /></button>
                          </PromptInputAction>
                        )}
                        <PromptInputAction tooltip={busy ? "Wait…" : "Send"}>
                          <motion.button whileTap={{ scale: 0.92, transition: spring.press }} type="button" onClick={() => void submitQuestion(input)} disabled={!input.trim() || busy} aria-label="Send message" className="grid size-10 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-forest-mid disabled:bg-forest/30">
                            {busy ? <Square size={13} fill="currentColor" /> : <ArrowUp size={19} />}
                          </motion.button>
                        </PromptInputAction>
                      </PromptInputActions>
                    </PromptInput>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {nudge && !open && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: spring.panel }}
                exit={{ opacity: 0, y: 6, transition: { duration: 0.2, ease: ease.inQuart } }}
                style={{ transformOrigin: "bottom right" }}
                className="relative max-w-[260px] rounded-2xl rounded-br-md border border-line bg-white py-3 pl-3.5 pr-9 text-sm shadow-[0_12px_40px_rgba(7,47,27,.18)]"
              >
                <button type="button" onClick={() => toggle(true)} className="text-left">
                  <span className="block text-[15px] font-semibold text-forest-text">Namaste 🙏</span>
                  <span className="text-ink-muted">Main aapka Personal Assistant hoon. Kuch poochna hai?</span>
                </button>
                <button type="button" onClick={() => toggle(false)} aria-label="Dismiss" className="absolute right-1 top-1 grid size-9 place-items-center rounded-full text-ink-muted hover:bg-co-panel"><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {!open && (
            <div className="flex items-center gap-2.5">
              {/* Label pill: hides for this visit once dismissed or while the nudge bubble is up. */}
              <AnimatePresence>
                {((labelReady && !labelHidden) || labelPeek) && !nudge && (
                  <motion.div
                    key="launcher-label"
                    initial={{ opacity: 0, x: 48, clipPath: "inset(0 0 0 100% round 999px)" }}
                    animate={{ opacity: 1, x: 0, clipPath: "inset(0 0 0 0% round 999px)", transition: { duration: 0.6, ease: ease.outExpo }, transitionEnd: { clipPath: "none" } }}
                    exit={{ opacity: 0, x: 32, clipPath: "inset(0 0 0 100% round 999px)", transition: { duration: 0.28, ease: ease.inQuart } }}
                    style={{ transformOrigin: "right center" }}
                    className="relative"
                    onHoverStart={() => setLabelPeek(true)}
                    onHoverEnd={() => setLabelPeek(false)}
                  >
                    <motion.button
                      {...tap}
                      type="button"
                      onClick={() => toggle(true)}
                      tabIndex={-1}
                      className="h-11 rounded-full bg-[linear-gradient(100deg,#0b3d22_0%,#2f5d3a_60%,#5f7f5c_100%)] pl-5 pr-6 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(7,47,27,.22)] max-sm:h-10 max-sm:pl-4 max-sm:pr-5 max-sm:text-[14px]"
                    >
                      Need help? Chat with me
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1, transition: { ...spring.press, delay: 0.45 } }}
                      type="button"
                      onClick={() => { setLabelHidden(true); setLabelPeek(false); }}
                      aria-label="Hide chat label"
                      className="absolute -right-2.5 -top-3 grid size-7 place-items-center rounded-full bg-white text-ink-muted shadow-[0_2px_8px_rgba(0,0,0,.15)] ring-1 ring-line transition-colors hover:text-ink"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.button
                ref={launcherRef}
                type="button"
                onClick={() => toggle(true)}
                aria-label="Open shopping assistant"
                aria-haspopup="dialog"
                {...tap}
                // Small pop back in once the panel has slid away (no scaling the photo up to panel size).
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1, transition: { ...spring.press, delay: 0.08 } }}
                style={{ borderRadius: 999 }}
                onHoverStart={() => setLabelPeek(true)}
                onHoverEnd={() => setLabelPeek(false)}
                className="group relative size-[64px] shrink-0 bg-white p-[3px] shadow-[0_8px_24px_rgba(7,47,27,.22)] ring-2 ring-[#cfe6d4] transition-shadow hover:ring-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mustard max-sm:size-[56px]"
              >
                {/* Idle "breathing" ring every 6s. */}
                <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-full border-2 border-forest" initial={{ scale: 1, opacity: 0 }} animate={{ scale: [1, 1.22], opacity: [0.45, 0] }} transition={{ duration: 1.2, ease: ease.outQuart, repeat: Infinity, repeatDelay: 4.8 }} />
                <span className="relative block size-full overflow-hidden rounded-full">
                  <Image src="/images/chat/dadi-assistant.jpg" alt="" fill sizes="64px" unoptimized className="scale-[1.06] object-cover" />
                </span>
                {/* "Online" dot, bottom-left so it doesn't cover the chat bubble baked into the photo. */}
                <span aria-hidden className="absolute bottom-0.5 left-0.5 size-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </motion.button>
            </div>
          )}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
