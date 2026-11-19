"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronRight, ClipboardCheck, FileText, House, LoaderCircle, PackageCheck, ShieldCheck, Truck, XCircle, type LucideIcon } from "lucide-react";
import { AddToCartCard, CartCard, ShopCard, ShopCards } from "@/components/chat/ChatCommerce";
import { RichText } from "@/components/chat/ChatParts";
import { ease, enter, move, rise, staggerParent, tap } from "@/components/chat/motion";
import { helpLink, site } from "@/data/site";
import { CheckoutCard } from "@/components/chat/CheckoutCard";
import { PhotoPicker, hasVideo, type HelpPhoto } from "@/components/account/help/PhotoPicker";
import type { ChatPlaceResult } from "@/lib/checkout-actions";
import type { ChatBlock, ChatBlockOf } from "@/lib/chat/blocks";

type Intent = "track" | "cancel" | "refund" | "return";
export type ConfirmExtras = { note?: string; photos?: { url: string; publicId: string }[] };
export type BlockHandlers = {
  sheetRoot: HTMLElement | null;
  onCheckoutLogin: () => void;
  onPlaced: (result: Extract<ChatPlaceResult, { ok: true }>) => void;
  onAsk: (text: string) => void;
  onLogin: (intent: Intent) => void;
  onOpenOrder: (order: ChatBlockOf<"order_list">["orders"][number], intent: Intent) => void;
  onConfirm: (block: ChatBlockOf<"action_confirm">, reason: string, extras?: ConfirmExtras) => Promise<void>;
  onDismiss: (block: ChatBlockOf<"action_confirm">) => void;
};

const card = "rounded-2xl border border-[#eadfca] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const primary = "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[15px] font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-60";
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const when = (value: string) => {
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}+05:30`);
  return Number.isNaN(date.getTime()) ? value : dateFmt.format(date);
};

/* ---------- order_status: animated timeline ---------- */
const STEPS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "placed", label: "Order mila", icon: ClipboardCheck },
  { key: "confirmed", label: "Confirm", icon: Check },
  { key: "packed", label: "Pack", icon: PackageCheck },
  { key: "shipped", label: "Raste mein", icon: Truck },
  { key: "delivered", label: "Deliver", icon: House },
];
/** Plain-language "where is it now" line for each step. */
const NOW: { title: string; hint: string }[] = [
  { title: "Order mil gaya hai", hint: "Hum ise jaldi confirm karenge." },
  { title: "Order confirm ho gaya", hint: "Ab pack hoga, phir courier ko diya jayega." },
  { title: "Order pack ho gaya", hint: "Jaldi courier ke saath nikal jayega." },
  { title: "Order raste mein hai", hint: "Courier aapke pass la raha hai." },
  { title: "Order deliver ho gaya", hint: "Umeed hai aapko pasand aaya. 🙏" },
];
const STEP_OF: Record<string, number> = { pending_payment: 0, payment_failed: 0, paid: 1, cod_pending: 1, confirmed: 1, packed: 2, shipped: 3, delivered: 4 };
const BADGE: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: "Payment pending", tone: "bg-warm text-ink" },
  payment_failed: { label: "Payment failed", tone: "bg-alert-soft text-alert" },
  paid: { label: "Placed", tone: "bg-co-brand-soft text-forest" },
  cod_pending: { label: "Placed · COD", tone: "bg-co-brand-soft text-forest" },
  confirmed: { label: "Placed", tone: "bg-co-brand-soft text-forest" },
  packed: { label: "Packed", tone: "bg-co-brand-soft text-forest" },
  shipped: { label: "Shipped", tone: "bg-mustard/25 text-forest" },
  delivered: { label: "Delivered", tone: "bg-emerald-50 text-emerald-800" },
  cancelled: { label: "Cancelled", tone: "bg-co-panel text-ink-muted" },
  rto: { label: "Returning", tone: "bg-warm text-ink" },
  refunded: { label: "Refunded", tone: "bg-co-panel text-ink-muted" },
  partially_refunded: { label: "Part refunded", tone: "bg-co-panel text-ink-muted" },
};

function OrderStatusBlock({ block }: { block: ChatBlockOf<"order_status"> }) {
  const { order } = block;
  const badge = BADGE[order.status] ?? { label: order.status.replaceAll("_", " "), tone: "bg-co-panel text-ink" };
  const current = STEP_OF[order.status];
  const onTrack = current !== undefined;
  const events = [...order.events].reverse().slice(0, 3);
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-ink">{order.orderNo}</p>
          <p className="text-[12.5px] text-ink-muted">{order.method === "cod" ? "Cash on delivery" : order.method ? "Prepaid" : ""}{order.eta ? ` · ETA ${order.eta}` : ""}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${badge.tone}`}>{badge.label}</span>
      </div>

      {onTrack && (
        <div className="rounded-xl bg-[#fbf6ec] px-2 pb-3 pt-3">
          <div className="px-1.5">
            <p className="text-[15px] font-semibold text-forest-text">{NOW[current].title}</p>
            <p className="text-[12.5px] text-ink-muted">{order.eta && current < 4 ? `Pahunchne ki ummeed: ${order.eta}` : NOW[current].hint}</p>
          </div>
          <ol className="relative mt-3.5 grid grid-cols-5" aria-label="Order progress">
            {/* Track runs between the first and last icon centres (10% → 90%). */}
            <span aria-hidden className="absolute left-[10%] right-[10%] top-[15px] h-[3px] rounded-full bg-[#e8dcc4]" />
            <motion.span
              aria-hidden
              className="absolute left-[10%] top-[15px] h-[3px] origin-left rounded-full bg-forest"
              style={{ width: `${(current / (STEPS.length - 1)) * 80}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1, transition: { ...move, duration: 0.6, delay: 0.15 } }}
            />
            {STEPS.map((step, index) => {
              const done = index < current;
              const now = index === current;
              const Icon = done ? Check : step.icon;
              return (
                <li key={step.key} className="relative flex flex-col items-center gap-1.5" aria-current={now ? "step" : undefined}>
                  <motion.span
                    className={`relative z-10 grid size-[33px] place-items-center rounded-full ${now ? "bg-forest text-white shadow-[0_4px_12px_rgba(7,47,27,.3)]" : done ? "bg-forest text-white" : "border-2 border-[#e8dcc4] bg-white text-[#c9b993]"}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, transition: enter(0.1 + index * 0.08) }}
                  >
                    {now && <motion.span aria-hidden className="absolute inset-0 rounded-full bg-forest/35" animate={{ scale: [1, 1.6], opacity: [0.6, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: ease.outQuart, repeatDelay: 0.5 }} />}
                    <Icon size={done ? 15 : 16} strokeWidth={done ? 3 : 2.2} className="relative" />
                  </motion.span>
                  <span className={`text-center text-[11.5px] leading-tight ${now ? "font-semibold text-forest-text" : done ? "text-ink" : "text-ink-muted"}`}>{step.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!!events.length && (
        <div className="rounded-xl bg-co-panel p-2.5">
          <p className="text-[12.5px] font-semibold text-forest">{order.courier ?? "Courier"}{order.awb ? ` · AWB ${order.awb}` : ""}</p>
          <ul className="mt-1 space-y-1">
            {events.map((event, index) => (
              <li key={`${event.at}-${index}`} className="text-[12.5px] text-ink-muted"><span className="capitalize text-ink">{event.label.toLowerCase()}</span> · {when(event.at)}{event.location ? ` · ${event.location}` : ""}</li>
            ))}
          </ul>
        </div>
      )}

      {!!order.refunds.length && (
        <p className="rounded-xl bg-co-panel p-2.5 text-[13px] text-ink">Refund <strong className="tabular-nums">₹{order.refunds[0].amount}</strong> · <span className="capitalize">{order.refunds[0].status.replaceAll("_", " ")}</span></p>
      )}

      {order.trackingUrl && (
        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-forest underline-offset-2 hover:underline">Courier site par dekhein<ArrowUpRight size={14} /></a>
      )}
    </div>
  );
}

/* ---------- order_list ---------- */
function OrderListBlock({ block, handlers }: { block: ChatBlockOf<"order_list">; handlers: BlockHandlers }) {
  return (
    <motion.div initial="hidden" animate="show" variants={staggerParent(0.05)} className={`${card} space-y-1.5`}>
      <p className="text-sm font-semibold text-ink">Kaunsa order?</p>
      {block.orders.map((order) => {
        const badge = BADGE[order.status] ?? { label: order.status, tone: "bg-co-panel text-ink" };
        return (
          <motion.button key={order.id} variants={rise} {...tap} type="button" onClick={() => handlers.onOpenOrder(order, block.intent)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line px-3 text-left transition-colors hover:border-forest/30 hover:bg-co-brand-soft">
            <span className="text-sm font-semibold text-ink">{order.orderNo}</span>
            <span className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}>{badge.label}</span><ChevronRight size={16} className="text-forest" /></span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

/* ---------- action_confirm ---------- */
const CANCEL_REASONS = ["Ordered by mistake", "Want to change items or address", "Found a better price", "Delivery is too slow", "Other"];
export const RETURN_CHOICES = ["Damaged or leaking", "Expired on arrival"] as const;

function ActionConfirmBlock({ block, handlers }: { block: ChatBlockOf<"action_confirm">; handlers: BlockHandlers }) {
  const isReturn = block.kind === "return";
  const [reason, setReason] = useState<string>(isReturn ? RETURN_CHOICES[0] : CANCEL_REASONS[0]);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<HelpPhoto[]>([]);
  const uploading = photos.some((photo) => photo.state === "uploading");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const title = block.kind === "cancel" ? `Cancel ${block.orderNo}?` : block.kind === "cancel_request" ? `Request cancellation of ${block.orderNo}?` : `Return request for ${block.orderNo}`;

  if (block.resolved) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-co-panel px-3 py-2.5 text-[13px] text-ink-muted">
        {block.resolved === "confirmed" ? <CheckCircle2 size={16} className="text-forest" /> : <XCircle size={16} />}
        {block.resolved === "confirmed" ? "Done." : "Okay, nothing was changed."}
      </div>
    );
  }
  return (
    <motion.div initial="hidden" animate="show" variants={staggerParent(0.06)} className="space-y-3 rounded-2xl border border-alert/25 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <motion.p variants={rise} className="flex items-center gap-2 text-[15px] font-semibold text-ink"><AlertTriangle size={17} className="text-alert" />{title}</motion.p>
      <motion.p variants={rise} className="text-sm text-ink">{block.summary}</motion.p>
      {!!block.consequences.length && (
        <motion.ul variants={rise} className="space-y-1">
          {block.consequences.map((line) => <li key={line} className="flex gap-2 text-[13px] text-ink-muted"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-mustard" />{line}</li>)}
        </motion.ul>
      )}
      {block.kind === "cancel" && (
        <motion.label variants={rise} className="block text-[12.5px] font-medium text-ink">
          Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
            {CANCEL_REASONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </motion.label>
      )}
      {isReturn && (
        <motion.div variants={rise} className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Return reason">
            {RETURN_CHOICES.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={reason === item} onClick={() => setReason(item)} className={`min-h-10 rounded-full border px-3 text-[13px] font-medium ${reason === item ? "border-forest bg-forest text-white" : "border-line text-ink"}`}>{item}</button>
            ))}
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} rows={2} placeholder="What happened? (optional)" className="w-full rounded-xl border border-line px-3 py-2 text-[15px] outline-none focus:border-forest/40" />
          <PhotoPicker photos={photos} setPhotos={setPhotos} video />
        </motion.div>
      )}
      {state === "error" && <p className="text-[13px] text-alert">Something went wrong. Please try again.</p>}
      <motion.div variants={rise} className="flex gap-2">
        <button type="button" disabled={state === "busy"} onClick={() => handlers.onDismiss(block)} className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-ink transition-colors hover:bg-co-panel">Go back</button>
        <motion.button
          {...tap}
          type="button"
          disabled={state === "busy" || uploading || (isReturn && !hasVideo(photos))}
          onClick={async () => {
            setState("busy");
            const done = photos.filter((photo) => photo.state === "done" && photo.url && photo.publicId).map((photo) => ({ url: photo.url!, publicId: photo.publicId! }));
            try { await handlers.onConfirm(block, reason, { note, photos: done }); } catch { setState("error"); return; }
            setState("idle");
          }}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-alert text-sm font-semibold text-white disabled:opacity-60"
        >
          {state === "busy" ? <LoaderCircle size={16} className="animate-spin" /> : block.kind === "cancel" ? "Yes, cancel" : isReturn ? "Send return request" : "Yes, send request"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ---------- comparison ---------- */
function ComparisonBlock({ block }: { block: ChatBlockOf<"comparison"> }) {
  return (
    <div className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[320px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="w-[28%] p-2.5" />
            {block.products.map((product) => (
              <th key={product.handle} className="p-2.5 align-bottom">
                <Link href={product.href} className="line-clamp-2 text-sm font-semibold text-ink hover:text-forest">{product.title.replace(/^Wood-Pressed\s+/i, "")}</Link>
                {product.titleHi && <span className="font-hindi block text-[12.5px] font-normal text-ink-muted">{product.titleHi}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-0">
              <th scope="row" className="p-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{row.label}</th>
              {row.values.map((value, index) => <td key={index} className="p-2.5 tabular-nums text-ink">{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- small blocks ---------- */
function InfoCardBlock({ block }: { block: ChatBlockOf<"info_card"> }) {
  return (
    <div className={`${card} space-y-1.5`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{block.source}</p>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink"><FileText size={16} className="text-forest" />{block.title}</p>
      {block.body && <div className="text-sm text-ink-muted"><RichText text={block.body} /></div>}
      {block.href && <Link href={block.href} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-forest underline-offset-2 hover:underline">Poora padhein<ArrowUpRight size={14} /></Link>}
    </div>
  );
}

function LoginCardBlock({ block, handlers }: { block: ChatBlockOf<"login_card">; handlers: BlockHandlers }) {
  return (
    <div className={`${card} space-y-2`}>
      <motion.button {...tap} type="button" onClick={() => handlers.onLogin(block.intent)} className={primary}><ShieldCheck size={16} />Login karein</motion.button>
      <Link href="/track-order" className="block text-center text-[12.5px] font-semibold text-ink-muted underline underline-offset-2 hover:text-forest">Bina login ke, order number se track karein</Link>
    </div>
  );
}

function HandoffBlock({ block }: { block: ChatBlockOf<"handoff"> }) {
  return (
    <div className={`${card} space-y-2`}>
      <p className="text-sm text-ink">{block.reason ?? "Our team will help you."} <span className="text-ink-muted">({site.supportHours})</span></p>
      <Link href={helpLink()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-forest text-sm font-semibold text-white">Raise a request</Link>
    </div>
  );
}

const NOTICE = {
  success: { icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  warning: { icon: AlertTriangle, tone: "border-warm-line bg-warm text-ink" },
  error: { icon: XCircle, tone: "border-alert/25 bg-alert-soft text-alert" },
} as const;
function NoticeBlock({ block }: { block: ChatBlockOf<"notice"> }) {
  const { icon: Icon, tone } = NOTICE[block.tone];
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: enter() }} className={`relative flex items-start gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-sm ${tone}`} role={block.tone === "error" ? "alert" : "status"}>
      {block.tone === "success" && <motion.span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" initial={{ x: "0%" }} animate={{ x: "450%", transition: { duration: 0.6, ease: ease.inOutCubic, delay: 0.1 } }} />}
      <Icon size={17} className="relative mt-px shrink-0" /><span className="relative">{block.text}</span>
    </motion.div>
  );
}

function OptionPickerBlock({ block, handlers }: { block: ChatBlockOf<"option_picker">; handlers: BlockHandlers }) {
  return (
    <div className={`${card} space-y-2`}>
      <p className="text-sm font-semibold text-ink">{block.question}</p>
      <div className="flex flex-wrap gap-1.5">
        {block.options.map((option) => <motion.button key={option} {...tap} type="button" onClick={() => handlers.onAsk(option)} className="min-h-10 rounded-full border border-forest/25 px-3.5 text-sm font-medium text-forest hover:bg-forest hover:text-white">{option}</motion.button>)}
      </div>
    </div>
  );
}

/** Renders a reply's typed blocks (quick_replies are shown by the chip row above the input). */
export function BlockList({ blocks, handlers, actionKey }: { blocks: ChatBlock[]; handlers: BlockHandlers; actionKey: string }) {
  const visible = blocks.filter((block) => block.type !== "quick_replies" && block.type !== "text");
  const cards = visible.filter((block) => block.type === "product_card") as ChatBlockOf<"product_card">[];
  return (
    <AnimatePresence initial={false}>
      <motion.div initial="hidden" animate="show" variants={staggerParent(0.06)} className="mt-2 space-y-2">
        {cards.length > 0 && <ShopCards items={cards.map((block) => block.product)} />}
        {visible.map((block, index) => {
          const key = `${block.type}-${index}`;
          switch (block.type) {
            case "product_card": return null;
            case "product_carousel": return <ShopCards key={key} items={block.products} />;
            case "comparison": return <motion.div key={key} variants={rise}><ComparisonBlock block={block} /></motion.div>;
            case "size_picker": return <motion.div key={key} variants={rise}><AddToCartCard intent={{ action: "add", product: block.product, variantId: block.variantId, qty: block.qty, done: block.done }} actionKey={`${actionKey}-${index}`} /></motion.div>;
            case "cart_summary": return <motion.div key={key} variants={rise}><CartCard title={block.title ?? "Aapka cart"} /></motion.div>;
            case "checkout_card": return <motion.div key={key} variants={rise}><CheckoutCard sheetRoot={handlers.sheetRoot} onLogin={handlers.onCheckoutLogin} onPlaced={handlers.onPlaced} /></motion.div>;
            case "order_status": return <motion.div key={key} variants={rise}><OrderStatusBlock block={block} /></motion.div>;
            case "order_list": return <motion.div key={key} variants={rise}><OrderListBlock block={block} handlers={handlers} /></motion.div>;
            case "action_confirm": return <motion.div key={key} variants={rise}><ActionConfirmBlock block={block} handlers={handlers} /></motion.div>;
            case "info_card": return <motion.div key={key} variants={rise}><InfoCardBlock block={block} /></motion.div>;
            case "login_card": return <motion.div key={key} variants={rise}><LoginCardBlock block={block} handlers={handlers} /></motion.div>;
            case "handoff": return <motion.div key={key} variants={rise}><HandoffBlock block={block} /></motion.div>;
            case "notice": return <motion.div key={key} variants={rise}><NoticeBlock block={block} /></motion.div>;
            case "option_picker": return <motion.div key={key} variants={rise}><OptionPickerBlock block={block} handlers={handlers} /></motion.div>;
            default: return null;
          }
        })}
      </motion.div>
    </AnimatePresence>
  );
}

export { ShopCard };
