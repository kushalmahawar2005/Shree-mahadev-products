import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getCashfreeOrder, getCashfreePayments, verifyCashfreeSignature } from "./cashfree";
import { db } from "./db";
import { notifyOrder } from "./mail";
import { flagOrder, getPayment, logWebhook, markPaid, markPaymentFailed } from "./orders";
import { queueOrderWhatsApp } from "./whatsapp";

async function notifyPaid(orderId: number) {
  await notifyOrder(orderId, "payment_received");
  await queueOrderWhatsApp(orderId, "order_placed").catch((error) => console.error("WhatsApp payment notification", error));
}

const FAILED = ["FAILED", "USER_DROPPED", "CANCELLED", "VOID"];

/**
 * Asks Cashfree about one attempt and applies the answer. Every path (popup result, return URL,
 * webhook, reconcile cron, admin check) goes through here, so it is always Cashfree's own API that
 * decides, never the browser or a webhook body. `final` = the reconcile cron: an attempt that is still
 * unpaid after 15 minutes with no payment in progress is closed as failed.
 */
export async function syncCashfreeAttempt(
  pay: { id: number; orderId: number; txnid: string; amount: number },
  opts: { final?: boolean } = {},
): Promise<"paid" | "failed" | "pending" | "unpaid"> {
  const order = await getCashfreeOrder(pay.txnid);
  if (!order) return "pending"; // Cashfree unreachable: try again later

  if (order.status === "PAID") {
    if (order.amount !== pay.amount) {
      // Money was taken but not the amount we asked for: never mark paid, and flag the order once so
      // the team sorts it out (refund or re-charge) instead of it sitting unpaid in silence.
      const reason = `Cashfree amount mismatch on ${pay.txnid}: paid ₹${order.amount}, expected ₹${pay.amount}`;
      await markPaymentFailed(pay.id, pay.orderId, reason, "pending");
      const [[o]] = await db().query<RowDataPacket[]>("SELECT attention FROM orders WHERE id = ?", [pay.orderId]);
      if (!String(o?.attention ?? "").includes(pay.txnid)) await flagOrder(db(), pay.orderId, reason, "cashfree");
      return "pending";
    }
    const success = (await getCashfreePayments(pay.txnid))?.find((p) => p.status === "SUCCESS");
    const res = await markPaid(pay.id, pay.orderId, { mihpayid: success?.id, mode: success?.group ?? "cashfree" });
    if (res === "paid") await notifyPaid(pay.orderId);
    return "paid";
  }

  if (order.status === "EXPIRED" || order.status === "TERMINATED" || order.status === "TERMINATION_REQUESTED") {
    await markPaymentFailed(pay.id, pay.orderId, `Cashfree: order ${order.status.toLowerCase()}`);
    return "failed";
  }

  // ACTIVE: not paid yet. Look at the latest attempt inside the Cashfree order.
  const payments = await getCashfreePayments(pay.txnid);
  if (!payments) return "pending";
  const latest = payments[payments.length - 1];
  if (latest?.status === "PENDING") {
    await markPaymentFailed(pay.id, pay.orderId, "Awaiting Cashfree confirmation", "pending");
    return "pending";
  }
  if (latest && FAILED.includes(latest.status)) {
    await markPaymentFailed(pay.id, pay.orderId, latest.message || `Cashfree: ${latest.status.toLowerCase()}`);
    return "failed";
  }
  if (opts.final) {
    await markPaymentFailed(pay.id, pay.orderId, "No payment found at Cashfree");
    return "failed";
  }
  return "unpaid"; // nothing tried yet (popup closed): the attempt stays open
}

/**
 * Popup closed / customer returned / admin check: ask Cashfree about every open attempt of this order
 * (a retry or a reload starts a new attempt, and the one that got paid isn't always the newest).
 */
export async function confirmOrderFromCashfree(orderToken: string): Promise<"paid" | "failed" | "pending" | "unpaid" | "none"> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT p.id, p.order_id, p.txnid, p.amount FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.token = ? AND p.provider = 'cashfree' AND p.status IN ('initiated','pending')
       AND p.created_at > NOW() - INTERVAL 2 DAY ORDER BY p.id DESC LIMIT 25`,
    [orderToken],
  );
  if (!rows.length) {
    // The webhook (or the cron) can settle the attempt before the popup's own check runs. Then there is
    // no open attempt left, and the order's own status is the answer.
    const [[o]] = await db().query<RowDataPacket[]>("SELECT paid_at FROM orders WHERE token = ?", [orderToken]);
    if (o?.paid_at) return "paid";
    return "none";
  }
  const rank = { failed: 0, unpaid: 1, pending: 2 } as const;
  let outcome: keyof typeof rank = "failed";
  for (const r of rows) {
    const res = await syncCashfreeAttempt({ id: r.id, orderId: r.order_id, txnid: r.txnid, amount: r.amount });
    if (res === "paid") return "paid";
    if (rank[res] > rank[outcome]) outcome = res;
  }
  return outcome;
}

/** Server-to-server webhook: signature must match, then Cashfree's API is asked for the real status. */
export async function handleCashfreeWebhook(rawBody: string, timestamp: string | null, signature: string | null) {
  if (!verifyCashfreeSignature(rawBody, timestamp, signature)) return { ok: false as const, outcome: "invalid" };
  let body: { type?: string; data?: { order?: { order_id?: string } } } = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false as const, outcome: "invalid" };
  }
  const txnid = body.data?.order?.order_id ?? null;
  await logWebhook("cashfree", txnid, body, body.type).catch((e) => console.error("logWebhook", e));
  if (!txnid) return { ok: true as const, outcome: "ignored" };
  const pay = await getPayment(txnid);
  if (!pay || pay.provider !== "cashfree") return { ok: true as const, outcome: "unknown" };
  if (pay.status === "success") return { ok: true as const, outcome: "duplicate" };
  const outcome = await syncCashfreeAttempt({ id: pay.id, orderId: pay.orderId, txnid, amount: pay.amount });
  return { ok: true as const, outcome };
}
