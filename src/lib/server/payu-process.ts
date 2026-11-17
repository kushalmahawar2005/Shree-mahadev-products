import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { notifyOrder } from "./mail";
import { queueOrderWhatsApp } from "./whatsapp";
import { getPayment, logWebhook, markPaid, markPaymentFailed } from "./orders";
import { verifyPaymentWithPayu, verifyPayuResponse } from "./payu";

async function notifyPaid(orderId: number) {
  await notifyOrder(orderId, "payment_received");
  await queueOrderWhatsApp(orderId, "order_placed").catch((error) => console.error("WhatsApp payment notification", error));
}

export type PayuOutcome = "paid" | "failed" | "pending" | "duplicate" | "invalid" | "unknown";

/**
 * One place that turns a PayU result into order state. Used by the browser callback (surl/furl)
 * and the server-to-server webhook, so whichever arrives first wins and the other is a no-op.
 * Never trusts the browser: hash + amount + verify_payment API must all agree.
 */
export async function handlePayuResult(p: Record<string, string>, source: "callback" | "webhook"): Promise<{ outcome: PayuOutcome; orderToken?: string }> {
  const safe = { ...p };
  delete safe.hash;
  await logWebhook("payu", p.txnid ?? null, { source, ...safe }, p.status).catch((e) => console.error("logWebhook", e));

  const pay = p.txnid ? await getPayment(p.txnid) : null;
  if (!pay) return { outcome: "unknown" };

  // Verify before revealing anything: the order token opens the order page (name, address, items),
  // so a guessed txnid with a forged body must get nothing back.
  if (!verifyPayuResponse(p) || p.udf1 !== pay.orderToken) {
    console.error("PayU hash mismatch", { txnid: p.txnid, source });
    // A forged or malformed callback must not fail the attempt or release its stock hold.
    // The reconciler will ask PayU directly for the transaction's actual status.
    return { outcome: "invalid" };
  }
  if (pay.status === "success") return { outcome: "duplicate", orderToken: pay.orderToken };

  if (p.status === "success" && Number(p.amount) === pay.amount) {
    const check = await verifyPaymentWithPayu(p.txnid);
    if (check?.status === "success" && check.amount === pay.amount) {
      const res = await markPaid(pay.id, pay.orderId, { mihpayid: p.mihpayid ?? check.mihpayid, mode: p.mode });
      // Messages only when this call moved the order to paid (callback + webhook race → one message;
      // money for a cancelled / already-paid order → flagged for refund, customer not told "paid").
      if (res === "paid") await notifyPaid(pay.orderId);
      return { outcome: res === "duplicate" ? "duplicate" : "paid", orderToken: pay.orderToken };
    }
    await markPaymentFailed(pay.id, pay.orderId, "Awaiting PayU confirmation", "pending");
    return { outcome: "pending", orderToken: pay.orderToken };
  }

  await markPaymentFailed(pay.id, pay.orderId, p.error_Message || p.field9 || p.status || "Payment failed");
  return { outcome: "failed", orderToken: pay.orderToken };
}

/**
 * Reconcile payments still initiated/pending after `olderThanMin` using PayU verify_payment.
 * Safe to run any time (cron every 15 min, or `pnpm payu:reconcile`).
 */
export async function reconcilePayments(olderThanMin = 15, limit = 50) {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT p.id, p.order_id, p.txnid, p.amount FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE p.status IN ('initiated','pending') AND p.created_at < NOW() - INTERVAL ? MINUTE
       AND p.created_at > NOW() - INTERVAL 7 DAY ORDER BY p.id LIMIT ?`,
    [olderThanMin, limit],
  );
  const result = { checked: rows.length, paid: 0, failed: 0, still: 0 };
  for (const r of rows) {
    const outcome = await reconcileOne({ id: r.id, orderId: r.order_id, txnid: r.txnid, amount: r.amount });
    result[outcome === "pending" ? "still" : outcome]++;
  }
  return result;
}

/** Ask PayU about one attempt and apply the answer. "pending" also covers PayU being unreachable. */
async function reconcileOne(r: { id: number; orderId: number; txnid: string; amount: number }): Promise<"paid" | "failed" | "pending"> {
  const v = await verifyPaymentWithPayu(r.txnid);
  if (v?.status === "success" && v.amount === r.amount) {
    if ((await markPaid(r.id, r.orderId, { mihpayid: v.mihpayid, mode: "reconciled" })) === "paid") await notifyPaid(r.orderId);
    return "paid";
  }
  if (v && ["failure", "failed", "userCancelled", "dropped", "bounced"].includes(v.status)) {
    await markPaymentFailed(r.id, r.orderId, `PayU: ${v.status}`);
    return "failed";
  }
  if (v?.status === "Not Found") {
    // Customer never reached PayU (closed the tab): mark the attempt failed.
    await markPaymentFailed(r.id, r.orderId, "No payment found at PayU");
    return "failed";
  }
  return "pending";
}

/**
 * Admin "Check with PayU" on one order: verifies its latest open attempt right now
 * (no age limit), using the same rules as the scheduled reconcile.
 */
export async function verifyOrderPayment(orderId: number): Promise<"paid" | "failed" | "pending" | "none"> {
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT id, order_id, txnid, amount FROM payments WHERE order_id = ? AND status IN ('initiated','pending') ORDER BY id DESC LIMIT 1",
    [orderId],
  );
  const r = rows[0];
  if (!r) return "none";
  return reconcileOne({ id: r.id, orderId: r.order_id, txnid: r.txnid, amount: r.amount });
}

/**
 * Browser came back from PayU without the form fields (some browsers drop the POST body when an
 * https page posts to an http/localhost return URL). We only know the order token from the URL, so
 * ask PayU directly about each open attempt; mark paid only when PayU itself confirms it.
 * Anything else is left untouched for the webhook / reconcile cron.
 */
export async function confirmOrderFromPayu(orderToken: string): Promise<"paid" | "pending" | "none"> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT p.id, p.order_id, p.txnid, p.amount FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.token = ? AND p.status IN ('initiated','pending') ORDER BY p.id DESC LIMIT 5`,
    [orderToken],
  );
  if (!rows.length) return "none";
  for (const r of rows) {
    const v = await verifyPaymentWithPayu(r.txnid);
    if (v?.status === "success" && v.amount === r.amount) {
      if ((await markPaid(r.id, r.order_id, { mihpayid: v.mihpayid, mode: "return-verify" })) === "paid") await notifyPaid(r.order_id);
      return "paid";
    }
  }
  return "pending";
}
