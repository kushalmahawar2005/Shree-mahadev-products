import { supportConfig } from "@/config/support";

/* Plain module (no "use client"): shared by the help page (server), its client parts and the server actions. */

export const ISSUES = {
  money_deducted: "Money deducted but unpaid",
  payment_failed: "Payment failed",
  cancel: "Cancel order",
  change_address: "Change address",
  when_ship: "When will it ship?",
  where_is_order: "Where is my order?",
  delayed: "Delivery delayed",
  change_date: "Change delivery date",
  damaged: "Damaged or leaked",
  wrong_item: "Wrong item",
  missing_item: "Missing item",
  quality: "Quality concern",
  return_refund: "Return / refund",
  refund_status: "Refund status",
  why_cancelled: "Why was it cancelled?",
  reorder_help: "Reorder help",
  not_placed: "Order not placed yet",
  product_question: "Product question",
  account: "Account",
  other: "Other",
  /** "Request a call back" button (order page / help page): any order status, note optional. */
  callback: "Call back request",
} as const;
export type IssueKey = keyof typeof ISSUES;
export const ISSUE_KEYS = Object.keys(ISSUES) as [IssueKey, ...IssueKey[]];

/** Issues where photos help (bottle/box + label). */
export const PHOTO_ISSUES: readonly IssueKey[] = ["damaged", "wrong_item", "missing_item", "quality"];

/** Which chips to offer for an order status (null = "Not about a specific order"). */
export function issuesFor(status: string | null): IssueKey[] {
  switch (status) {
    case null:
      return ["not_placed", "product_question", "account", "other"];
    case "pending_payment":
    case "payment_failed":
      return ["money_deducted", "payment_failed", "cancel", "other"];
    case "paid":
    case "cod_pending":
    case "confirmed":
    case "packed":
      return ["change_address", "cancel", "when_ship", "other"];
    case "shipped":
    case "out_for_delivery":
      return ["where_is_order", "delayed", "change_date", "other"];
    case "delivered":
    case "return_requested":
      return ["damaged", "wrong_item", "missing_item", "quality", "return_refund", "other"];
    default: // cancelled, refunded, partially_refunded, rto
      return ["refund_status", "why_cancelled", "reorder_help", "other"];
  }
}

/**
 * Same rules as cancelMyOrderAction. A shopper can cancel by themselves only before the shipment is
 * created (courier booked): COD orders, or unpaid online orders. Paid online orders go to the team
 * (refund needed). `booked` = an active shipment exists for the order.
 */
export function cancelRule(
  status: string,
  method: string,
  booked = false,
): { ok: true } | { ok: false; reason: string; canRequest?: boolean } {
  if (!["pending_payment", "cod_pending", "confirmed", "packed", "paid"].includes(status))
    return { ok: false, reason: "This order has already shipped, so it can't be cancelled here. Tell us below and we'll help." };
  if (booked)
    return { ok: false, reason: "This order is already booked with the courier, so it can't be cancelled here. Tell us below and we'll help." };
  if (isPaidOnline(status, method))
    return { ok: false, canRequest: true, reason: PAID_CANCEL_MESSAGE };
  return { ok: true };
}

/** Paid online (PayU) and not shipped yet: cancelling needs a refund, so the team does it on request. */
export const isPaidOnline = (status: string, method: string) =>
  method === "payu" && ["paid", "confirmed", "packed"].includes(status);

export const PAID_CANCEL_MESSAGE =
  "Ye order online paid hai, isliye hamari team ise cancel karke poora refund karegi. Neeche \"Cancel request bhejein\" dabaiye.";

/** "12 Nov" from an IST DB string. */
export function shortDate(raw: string) {
  const d = new Date(`${raw.replace(" ", "T")}${/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? "" : "+05:30"}`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
}

/** Online/offline line for the contact card, computed in IST from supportConfig.hours. */
export function supportStatus(now = new Date()): { online: boolean; text: string } {
  const { days, open, close } = supportConfig.hours;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const openLabel = `${open % 12 || 12} ${open < 12 ? "AM" : "PM"}`;
  if (days.includes(wd) && hour >= open && hour < close)
    return { online: true, text: `We're online · replies in ${supportConfig.replyTime}` };
  if (days.includes(wd) && hour < open) return { online: false, text: `We're offline · we'll reply by ${openLabel} today` };
  for (let i = 1; i <= 7; i++) {
    const d = (wd + i) % 7;
    if (!days.includes(d)) continue;
    const when = i === 1 ? "tomorrow" : `on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]}`;
    return { online: false, text: `We're offline · we'll reply by ${openLabel} ${when}` };
  }
  return { online: false, text: "We're offline · we'll reply soon" };
}

export const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-co-accent-soft text-co-accent-ink ring-co-accent/30" },
  in_progress: { label: "In progress", cls: "bg-co-brand-soft text-forest-text ring-forest/20" },
  resolved: { label: "Resolved", cls: "bg-co-success-soft text-co-success ring-co-success/25" },
};

/* ── Types shared between the page, the client flow and the actions ── */

export type HelpOrderOption = {
  id: number;
  orderNo: string;
  status: string;
  total: number;
  createdAt: string;
  itemCount: number;
  handles: string[];
  eta: string | null;
};

/** Order list row (server or /api/account/orders JSON) → picker option. */
export const toHelpOption = (o: {
  id: number;
  orderNo: string;
  status: string;
  total: number;
  createdAt: string;
  eta: string | null;
  items: { handle: string; qty: number }[];
}): HelpOrderOption => ({
  id: o.id,
  orderNo: o.orderNo,
  status: o.status,
  total: o.total,
  createdAt: o.createdAt,
  eta: o.eta,
  itemCount: o.items.reduce((s, i) => s + i.qty, 0),
  handles: [...new Set(o.items.map((i) => i.handle))].slice(0, 4),
});

export type HelpOrderDetail = {
  id: number;
  orderNo: string;
  status: string;
  method: string;
  eta: string | null;
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
  lastScan: { status: string; location: string | null; at: string } | null;
  refunds: { amount: number; status: string; at: string; ref: string | null }[];
  cancelReason: string | null;
  canCancel: { ok: true } | { ok: false; reason: string };
  returnDaysLeft: number | null;
  returnRequested: boolean;
};

export type HelpTicket = {
  id: number;
  ticketNo: string;
  orderId: number | null;
  orderNo: string | null;
  issue: string;
  message: string;
  utr: string | null;
  contactPref: "whatsapp" | "call";
  callbackSlot: string | null;
  status: string;
  createdAt: string;
  photos: string[];
};
