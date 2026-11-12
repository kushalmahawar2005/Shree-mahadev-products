import { accountConfig } from "@/config/account";
import type { AccountOrderDetail } from "@/lib/server/account";

/* Status → how the order detail page looks and what it offers. Plain module (server + client). */

export type Tone = "amber" | "red" | "blue" | "indigo" | "teal" | "green" | "neutral" | "orange";
export type PrimaryKind = "pay" | "retry" | "track" | "track-disabled" | "reorder";

export const TONE_CLASSES: Record<Tone, { banner: string; icon: string; text: string }> = {
  amber: { banner: "border-amber-200 bg-amber-50", icon: "text-amber-700 ring-amber-200", text: "text-amber-900/80" },
  red: { banner: "border-red-200 bg-red-50", icon: "text-red-700 ring-red-200", text: "text-red-900/80" },
  blue: { banner: "border-sky-200 bg-sky-50", icon: "text-sky-700 ring-sky-200", text: "text-sky-900/80" },
  indigo: { banner: "border-indigo-200 bg-indigo-50", icon: "text-indigo-700 ring-indigo-200", text: "text-indigo-900/80" },
  teal: { banner: "border-teal-200 bg-teal-50", icon: "text-teal-700 ring-teal-200", text: "text-teal-900/80" },
  green: { banner: "border-emerald-200 bg-emerald-50", icon: "text-emerald-700 ring-emerald-200", text: "text-emerald-900/80" },
  neutral: { banner: "border-line bg-page", icon: "text-ink-muted ring-line", text: "text-ink-muted" },
  orange: { banner: "border-orange-200 bg-orange-50", icon: "text-orange-700 ring-orange-200", text: "text-orange-900/80" },
};

export type StatusUi = {
  tone: Tone;
  icon: "card" | "alert" | "box" | "truck" | "check" | "x" | "undo";
  title: string;
  text: string;
  primary: PrimaryKind | null;
  /** Shown in the savings pill / not for cancelled or unpaid orders. */
  showSavings: boolean;
};

const IST = (raw: string, time = true) => {
  const d = new Date(`${raw.replace(" ", "T")}${/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? "" : "+05:30"}`);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    ...(time ? { hour: "numeric", minute: "2-digit", hour12: true } : {}),
  })
    .format(d)
    .replace(" am", " AM")
    .replace(" pm", " PM");
};

/** True once money was actually captured for an online order. */
export const isCaptured = (o: AccountOrderDetail) =>
  o.method !== "cod" && (Boolean(o.paidAt) || o.payment?.status === "success" || o.payment?.status === "refunded");

/** Why it was cancelled, in shopper words (from the cancelled order_event). */
export function cancelReason(o: AccountOrderDetail): string {
  const ev = [...o.events].reverse().find((e) => e.to === "cancelled");
  if (!ev) return "This order was cancelled.";
  const note = ev.note?.replace(/^Cancelled by customer:\s*/i, "").trim();
  if (ev.actor === "customer") return `Cancelled by you${note ? `: ${note}` : ""}`;
  if (ev.actor === "admin") return `Cancelled by store${note ? `: ${note}` : ""}`;
  return "Payment not completed in time";
}

export const cancelledAt = (o: AccountOrderDetail) =>
  o.cancelledAt ?? [...o.events].reverse().find((e) => e.to === "cancelled")?.at ?? null;

export const deliveredAt = (o: AccountOrderDetail) =>
  o.deliveredAt ?? [...o.events].reverse().find((e) => e.to === "delivered")?.at ?? null;

/** "22 Nov" — last day a return can be requested, or null. */
export function returnClosesOn(o: AccountOrderDetail) {
  const d = deliveredAt(o);
  if (!d) return null;
  const end = new Date(`${d.replace(" ", "T")}+05:30`);
  end.setDate(end.getDate() + accountConfig.returnWindowDays);
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(end);
}

export function statusUi(o: AccountOrderDetail, eta: string | null): StatusUi {
  const expired = o.status === "pending_payment" && o.expiresInHours !== null && o.expiresInHours <= 0;
  switch (expired ? "expired" : o.status) {
    case "pending_payment":
      return {
        tone: "amber",
        icon: "card",
        title: "Payment pending",
        text:
          o.expiresInHours !== null
            ? `Complete payment within ${o.expiresInHours}h or this order will be cancelled automatically.`
            : "Complete payment to confirm this order.",
        primary: "pay",
        showSavings: false,
      };
    case "expired":
      return {
        tone: "neutral",
        icon: "x",
        title: "Payment window closed",
        text: "This order wasn't paid in time, so it will be cancelled. No money was taken.",
        primary: "reorder",
        showSavings: false,
      };
    case "payment_failed":
      return {
        tone: "red",
        icon: "alert",
        title: "Payment didn't go through",
        text: "No money was deducted. If it was, your bank refunds it in 5–7 days.",
        primary: "retry",
        showSavings: false,
      };
    case "paid":
    case "cod_pending":
    case "confirmed":
      return {
        tone: "blue",
        icon: "box",
        title: "Order confirmed. We're packing it fresh",
        text: eta ?? "Usually ships within 1–2 days. You'll get the tracking link on WhatsApp.",
        primary: "track-disabled",
        showSavings: true,
      };
    case "packed":
      return {
        tone: "blue",
        icon: "box",
        title: "Packed and ready to ship",
        text: eta ?? "Handing it to the courier soon. You'll get the tracking link on WhatsApp.",
        primary: "track-disabled",
        showSavings: true,
      };
    case "shipped":
      return {
        tone: "indigo",
        icon: "truck",
        title: `On the way${eta ? ` · ${eta}` : ""}`,
        text: o.courier ? `Shipped with ${o.courier}.` : "Your order has left our ghani.",
        primary: "track",
        showSavings: true,
      };
    case "out_for_delivery":
      return {
        tone: "teal",
        icon: "truck",
        title: "Out for delivery today",
        text: `${o.courier ? `${o.courier} is` : "The courier is"} bringing it to you. Keep your phone handy.`,
        primary: "track",
        showSavings: true,
      };
    case "delivered": {
      const at = deliveredAt(o);
      return {
        tone: "green",
        icon: "check",
        title: at ? `Delivered on ${IST(at)}` : "Delivered",
        text: "Hope you love it. Reorder in one tap when you run low.",
        primary: "reorder",
        showSavings: true,
      };
    }
    case "cancelled": {
      const at = cancelledAt(o);
      return {
        tone: "neutral",
        icon: "x",
        title: at ? `Order cancelled on ${IST(at)}` : "Order cancelled",
        text: cancelReason(o),
        primary: "reorder",
        showSavings: false,
      };
    }
    case "rto":
      return {
        tone: "orange",
        icon: "undo",
        title: "Returned to us by the courier",
        text: "The courier couldn't deliver it. We'll contact you about a refund or re-delivery.",
        primary: "reorder",
        showSavings: false,
      };
    case "refunded":
    case "partially_refunded":
      return {
        tone: "orange",
        icon: "undo",
        title: o.status === "refunded" ? "Refunded" : "Partly refunded",
        text: "The refund goes back to your original payment method.",
        primary: "reorder",
        showSavings: false,
      };
    default:
      return { tone: "neutral", icon: "box", title: "Order update", text: "", primary: "reorder", showSavings: false };
  }
}

/* ── Timeline built from real order_events ── */

export type TimelineEntry = { key: string; label: string; at: string | null; state: "done" | "current" | "todo" | "cancelled"; note?: string };

const FLOW = [
  { key: "ordered", label: "Ordered", match: [] as string[] },
  { key: "confirmed", label: "Payment confirmed", match: ["paid", "cod_pending", "confirmed"] },
  { key: "packed", label: "Packed", match: ["packed"] },
  { key: "shipped", label: "Shipped", match: ["shipped"] },
  { key: "ofd", label: "Out for delivery", match: ["out_for_delivery"] },
  { key: "delivered", label: "Delivered", match: ["delivered"] },
];

export function buildTimeline(o: AccountOrderDetail): TimelineEntry[] {
  const first = (statuses: string[]) => o.events.find((e) => statuses.includes(e.to))?.at ?? null;
  const times = FLOW.map((s, i) => (i === 0 ? o.createdAt : first(s.match)));
  const label = (i: number) => (i === 1 && o.method === "cod" ? "Order confirmed" : FLOW[i]!.label);
  const cancelled = ["cancelled", "rto", "refunded", "partially_refunded"].includes(o.status) && !times[5];

  if (cancelled || o.status === "payment_failed" || (o.status === "pending_payment" && o.expiresInHours !== null && o.expiresInHours <= 0)) {
    // Only what actually happened, ending in the cancellation.
    const out: TimelineEntry[] = FLOW.flatMap((s, i) =>
      times[i] ? [{ key: s.key, label: label(i), at: times[i], state: "done" as const }] : [],
    );
    if (o.status === "payment_failed")
      out.push({ key: "failed", label: "Payment failed", at: first(["payment_failed"]), state: "cancelled" });
    else if (o.status === "rto")
      out.push({ key: "rto", label: "Returned to us", at: first(["rto"]), state: "cancelled" });
    else
      out.push({ key: "cancelled", label: "Cancelled", at: cancelledAt(o), state: "cancelled", note: cancelReason(o) });
    return out;
  }

  // Normal flow: highest step reached (status wins if an event is missing).
  const byStatus: Record<string, number> = {
    pending_payment: 0, paid: 1, cod_pending: 1, confirmed: 1, packed: 2, shipped: 3, out_for_delivery: 4, delivered: 5,
  };
  const reached = Math.max(byStatus[o.status] ?? 0, ...times.map((t, i) => (t ? i : 0)));
  return FLOW.map((s, i) => ({
    key: s.key,
    label: i === 1 && o.status === "pending_payment" ? "Payment" : label(i),
    at: i <= reached ? times[i] : null,
    state: i < reached || (i === reached && reached === 5) ? "done" : i === reached ? "current" : "todo",
  }));
}

export const PAY_MODES: Record<string, string> = {
  UPI: "UPI",
  CC: "Credit card",
  DC: "Debit card",
  NB: "Net banking",
  CASH: "Wallet",
  EMI: "EMI",
};

/** "SMP1311T…9xch" for long ids. */
export const middleTruncate = (s: string, keep = 8) =>
  s.length <= keep * 2 + 1 ? s : `${s.slice(0, keep)}…${s.slice(-4)}`;
