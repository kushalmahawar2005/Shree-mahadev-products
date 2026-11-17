"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, ChevronRight, Clock, Droplets, HelpCircle, Leaf, Package, Ruler, ShoppingBag, TicketPercent, Truck, type LucideIcon } from "lucide-react";
import { enter, ease, rise, staggerParent, tap } from "@/components/chat/motion";
import type { ShopProduct } from "@/components/chat/ChatCommerce";

export type OrderIntent = "track" | "cancel" | "refund" | "return";
/** At most one smart card under the greeting, in priority order; "none" shows nothing. */
export type WelcomeContext =
  | { kind: "order"; orderNo: string; status: string; eta?: string | null; onOpen: () => void }
  | { kind: "product"; product: ShopProduct }
  | { kind: "cart"; count: number; subtotal: number }
  | { kind: "none" };

export type Chip = { label: string; icon: LucideIcon; run: () => void };

const STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: "Payment pending", tone: "bg-warm text-ink" },
  paid: { label: "Confirmed", tone: "bg-co-brand-soft text-forest" },
  cod_pending: { label: "Confirmed", tone: "bg-co-brand-soft text-forest" },
  confirmed: { label: "Confirmed", tone: "bg-co-brand-soft text-forest" },
  packed: { label: "Packed", tone: "bg-co-brand-soft text-forest" },
  shipped: { label: "Shipped", tone: "bg-mustard/20 text-forest" },
};
const rupee = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const box = "flex w-full items-center gap-3 rounded-xl border border-[#eadfca] bg-white p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-[border-color,box-shadow] hover:border-forest/30 hover:shadow-[0_4px_12px_rgba(7,47,27,.08)]";

function SmartCard({ context, onAskProduct }: { context: WelcomeContext; onAskProduct: (product: ShopProduct) => void }) {
  if (context.kind === "order") {
    const status = STATUS[context.status] ?? { label: context.status.replaceAll("_", " "), tone: "bg-co-panel text-ink" };
    return (
      <motion.button {...tap} type="button" onClick={context.onOpen} className={box}>
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#fbf3e3] text-forest"><Truck size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="text-[15px] font-semibold text-ink">{context.orderNo}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>{status.label}</span></span>
          <span className="block truncate text-[12.5px] text-ink-muted">{context.eta ? `ETA ${context.eta}` : "Live status dekhein"}</span>
        </span>
        <span className="flex shrink-0 items-center text-[13px] font-semibold text-forest">Track<ChevronRight size={16} /></span>
      </motion.button>
    );
  }
  if (context.kind === "product") {
    const { product } = context;
    return (
      <motion.button {...tap} type="button" onClick={() => onAskProduct(product)} className={box}>
        <span className="relative size-11 shrink-0 overflow-hidden rounded-[10px] bg-[#fbf3e3]">{product.image && <Image src={product.image} alt="" fill sizes="44px" className="object-cover" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{product.title}</span>
          <span className="block truncate text-[12.5px] text-ink-muted"><span className="font-semibold tabular-nums text-forest">{rupee(product.price)}</span> se shuru</span>
        </span>
        <span className="flex shrink-0 items-center text-[13px] font-semibold text-forest">Poochiye<ChevronRight size={16} /></span>
      </motion.button>
    );
  }
  if (context.kind === "cart") {
    return (
      <Link href="/checkout" className={box}>
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#fbf3e3] text-forest"><ShoppingBag size={20} /></span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">Cart mein {context.count} item{context.count === 1 ? "" : "s"} · <span className="tabular-nums">{rupee(context.subtotal)}</span></span>
        <span className="flex shrink-0 items-center text-[13px] font-semibold text-forest">Checkout<ChevronRight size={16} /></span>
      </Link>
    );
  }
  return null;
}

/** Chat tab's empty state: one greeting, at most one smart card. Chips live above the input. */
export function ChatWelcome({ avatar, context, onAskProduct }: { avatar: React.ReactNode; context: WelcomeContext; onAskProduct: (product: ShopProduct) => void }) {
  return (
    <motion.div initial="hidden" animate="show" variants={staggerParent(0.06)} className="space-y-3 px-3.5 py-4">
      <motion.div variants={rise} className="flex gap-2">
        {avatar}
        <div className="rounded-2xl rounded-tl-md border border-line bg-white px-3.5 py-2.5 text-[15px] leading-normal text-ink shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          Namaste 🙏 Main <strong className="font-semibold text-forest-text">Mahadev Sahayak</strong>.<br />Kya madad karun?
        </div>
      </motion.div>
      {context.kind !== "none" && (
        <motion.div variants={rise} className="pl-10">
          <SmartCard context={context} onAskProduct={onAskProduct} />
        </motion.div>
      )}
    </motion.div>
  );
}

export const CHIP_ICONS = { Banknote, ChevronRight, Clock, Droplets, HelpCircle, Leaf, Package, Ruler, ShoppingBag, TicketPercent, Truck } as const;

/**
 * Suggestion chips pinned above the input. Welcome: up to 4, wrapping to 2 lines.
 * Conversation: a slim single row that scrolls sideways.
 */
export function ChipRow({ chips, slim, disabled }: { chips: Chip[]; slim: boolean; disabled?: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!!chips.length && (
        <motion.div
          key={slim ? "slim" : "full"}
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: enter(slim ? 0 : 0.12) }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }}
          className={slim ? "-mx-3 -my-1 flex gap-1.5 overflow-x-auto px-3 py-1 [scrollbar-width:none]" : "flex flex-wrap gap-1.5"}
        >
          {chips.slice(0, slim ? 6 : 4).map(({ label, icon: Icon, run }) => (
            <motion.button
              key={label}
              {...tap}
              type="button"
              disabled={disabled}
              onClick={run}
              className={`relative flex shrink-0 items-center gap-1 rounded-full border border-[#eadfca] bg-white font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-colors after:absolute after:-inset-y-1 after:inset-x-0 hover:border-forest/30 hover:text-forest disabled:opacity-50 ${slim ? "h-8 px-3 text-[13px]" : "h-9 px-2.5 text-sm"}`}
            >
              <Icon size={slim ? 13 : 14} className="text-forest" />{label}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
