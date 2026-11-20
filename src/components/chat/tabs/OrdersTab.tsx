"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import * as Duo from "@/components/icons/duo";
import { rise, staggerParent, tap } from "@/components/chat/motion";

export type OrderRow = {
  id: number; orderNo: string; status: string; createdAt: string; eta?: string | null;
  total?: number; method?: string; itemCount?: number;
  firstItem?: { title: string; variant: string; image: string | null } | null;
};
type Action = "track" | "cancel" | "return" | "refund" | "reorder";

const STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: "Payment pending", tone: "bg-warm text-ink" },
  payment_failed: { label: "Payment failed", tone: "bg-alert-soft text-alert" },
  paid: { label: "Placed", tone: "bg-co-brand-soft text-forest" },
  cod_pending: { label: "Placed", tone: "bg-co-brand-soft text-forest" },
  confirmed: { label: "Placed", tone: "bg-co-brand-soft text-forest" },
  packed: { label: "Packed", tone: "bg-co-brand-soft text-forest" },
  shipped: { label: "Shipped", tone: "bg-mustard/25 text-forest" },
  out_for_delivery: { label: "Out for delivery", tone: "bg-mustard/25 text-forest" },
  delivered: { label: "Delivered", tone: "bg-emerald-50 text-emerald-800" },
  cancelled: { label: "Cancelled", tone: "bg-co-panel text-ink-muted" },
  rto: { label: "Returning", tone: "bg-warm text-ink" },
  refunded: { label: "Refunded", tone: "bg-co-panel text-ink-muted" },
  partially_refunded: { label: "Part refunded", tone: "bg-co-panel text-ink-muted" },
};
const CANCELLABLE = ["pending_payment", "cod_pending", "confirmed", "packed", "paid"];
const REORDERABLE = ["paid", "cod_pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded", "partially_refunded"];
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const placed = (value: string) => {
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}+05:30`);
  return Number.isNaN(date.getTime()) ? "" : dateFmt.format(date);
};
const rupee = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const action = "min-h-10 rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-forest/30 hover:text-forest";

/** Orders tab: newest first, paginated, with only the actions that are valid for each order. */
export default function OrdersTab({ onAction, onLogin, onShop }: { onAction: (order: OrderRow, action: Action, all: OrderRow[]) => void; onLogin: () => void; onShop: () => void }) {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; signedIn: boolean; orders: OrderRow[]; hasMore: boolean }>({ status: "loading", signedIn: false, orders: [], hasMore: false });
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/chat/orders?page=${page}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { authenticated?: boolean; orders?: OrderRow[]; hasMore?: boolean }) => {
        if (!alive) return;
        setState({ status: "ready", signedIn: Boolean(data.authenticated), orders: data.orders ?? [], hasMore: Boolean(data.hasMore) });
        setLoadingMore(false);
      })
      .catch(() => { if (alive) { setState((current) => ({ ...current, status: "error" })); setLoadingMore(false); } });
    return () => { alive = false; };
  }, [page, attempt]);

  if (state.status === "loading") {
    return (
      <div className="space-y-2.5 px-3.5 py-3.5" aria-busy="true">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-3 rounded-2xl border border-line bg-white p-3.5">
            <div className="flex gap-3"><div className="size-12 animate-pulse rounded-[10px] bg-co-panel" /><div className="flex-1 space-y-2"><div className="h-4 w-1/2 animate-pulse rounded bg-co-panel" /><div className="h-3 w-2/3 animate-pulse rounded bg-co-panel" /></div></div>
            <div className="h-9 w-2/3 animate-pulse rounded-full bg-co-panel" />
          </div>
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="m-3.5 rounded-2xl border border-warm-line bg-warm p-4 text-sm text-ink" role="alert">
        Orders load nahi ho paaye.
        <button type="button" onClick={() => { setState((current) => ({ ...current, status: "loading" })); setAttempt((value) => value + 1); }} className="ml-2 inline-flex min-h-11 items-center gap-1 font-semibold text-forest underline underline-offset-2"><RotateCcw size={13} />Dobara try karein</button>
      </div>
    );
  }
  if (!state.signedIn && !state.orders.length) {
    return (
      <motion.div initial="hidden" animate="show" variants={rise} className="m-3.5 rounded-2xl border border-line bg-white p-5 text-center shadow-[0_1px_2px_rgba(0,0,0,.04)]">
        <Duo.Lock size={36} className="mx-auto" />
        <p className="mt-3 text-base font-semibold text-ink">Apne orders dekhne ke liye login karein</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">Sirf phone number aur OTP. Login ke baad aap yahin wapas aa jayenge.</p>
        <motion.button {...tap} type="button" onClick={onLogin} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[15px] font-semibold text-white transition-colors hover:bg-forest-mid"><ShieldCheck size={16} />Login karein</motion.button>
        <Link href="/track-order" className="mt-2 inline-flex min-h-11 items-center text-[12.5px] font-semibold text-ink-muted underline underline-offset-2 hover:text-forest">Bina login ke order number se track karein</Link>
      </motion.div>
    );
  }
  if (!state.orders.length) {
    return (
      <div className="m-3.5 rounded-2xl border border-line bg-white p-5 text-center">
        <Duo.Package size={36} className="mx-auto" />
        <p className="mt-3 text-base font-semibold text-ink">Abhi koi order nahi hai</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">Pehla order kijiye, ghani ka taaza tel ghar tak. 🛒</p>
        <motion.button {...tap} type="button" onClick={onShop} className="mt-4 h-11 w-full rounded-xl bg-forest text-[15px] font-semibold text-white">Shop dekhein</motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 px-3.5 py-3.5">
      <motion.ul initial="hidden" animate="show" variants={staggerParent(0.05)} className="space-y-2.5">
        {state.orders.map((order) => {
          const status = STATUS[order.status] ?? { label: order.status.replaceAll("_", " "), tone: "bg-co-panel text-ink-muted" };
          const more = (order.itemCount ?? 1) - 1;
          const showRefund = (order.status === "cancelled" && order.method === "payu") || order.status === "refunded" || order.status === "partially_refunded";
          return (
            <motion.li key={order.id} variants={rise} className="rounded-2xl border border-[#eadfca] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
              <div className="flex gap-3">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-[10px] bg-[#fbf3e3]">
                  {order.firstItem?.image ? <Image src={order.firstItem.image} alt="" fill sizes="48px" className="object-cover" /> : <Duo.Package size={24} className="absolute inset-0 m-auto" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold text-ink">{order.orderNo}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${status.tone}`}>{status.label}</span>
                  </div>
                  {order.firstItem && <p className="truncate text-[13px] text-ink">{order.firstItem.title} · {order.firstItem.variant}{more > 0 ? ` aur ${more} items` : ""}</p>}
                  <p className="text-[12.5px] text-ink-muted">
                    {placed(order.createdAt)}
                    {order.total != null ? <> · <span className="tabular-nums">{rupee(order.total)}</span></> : null}
                    {order.method ? ` · ${order.method === "cod" ? "COD" : "Prepaid"}` : ""}
                    {order.eta ? ` · ETA ${order.eta}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <motion.button {...tap} type="button" onClick={() => onAction(order, "track", state.orders)} className="min-h-10 rounded-full bg-forest px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-forest-mid">Track</motion.button>
                {CANCELLABLE.includes(order.status) && !(order.method !== "cod" && ["paid", "confirmed", "packed"].includes(order.status)) && <motion.button {...tap} type="button" onClick={() => onAction(order, "cancel", state.orders)} className={`${action} hover:border-alert/40 hover:text-alert`}>Cancel</motion.button>}
                {order.status === "delivered" && <motion.button {...tap} type="button" onClick={() => onAction(order, "return", state.orders)} className={action}>Return / damage</motion.button>}
                {showRefund && <motion.button {...tap} type="button" onClick={() => onAction(order, "refund", state.orders)} className={action}>Refund status</motion.button>}
                {REORDERABLE.includes(order.status) && <motion.button {...tap} type="button" onClick={() => onAction(order, "reorder", state.orders)} className={action}>Reorder</motion.button>}
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
      {state.hasMore && (
        <button type="button" disabled={loadingMore} onClick={() => { setLoadingMore(true); setPage((value) => value + 1); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold text-forest">
          {loadingMore && <LoaderCircle size={15} className="animate-spin" />}Aur dikhayein
        </button>
      )}
    </div>
  );
}
