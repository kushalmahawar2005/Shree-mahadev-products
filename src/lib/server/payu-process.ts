import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { notifyOrder } from "./mail";
import { getPayment, logWebhook, markPaid, markPaymentFailed } from "./orders";
import { verifyPaymentWithPayu, verifyPayuResponse } from "./payu";

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
  if (pay.status === "success") return { outcome: "duplicate", orderToken: pay.orderToken };

  if (!verifyPayuResponse(p) || p.udf1 !== pay.orderToken) {
    console.error("PayU hash mismatch", { txnid: p.txnid, source });
    // A forged/garbled browser post must not fail a real payment; only the callback marks it.
    if (source === "callback") await markPaymentFailed(pay.id, pay.orderId, "Hash verification failed");
    return { outcome: "invalid", orderToken: pay.orderToken };
  }

  if (p.status === "success" && Number(p.amount) === pay.amount) {
    const check = await verifyPaymentWithPayu(p.txnid);
    if (check?.status === "success" && check.amount === pay.amount) {
      await markPaid(pay.id, pay.orderId, { mihpayid: p.mihpayid ?? check.mihpayid, mode: p.mode });
      await notifyOrder(pay.orderId, "payment_received");
      return { outcome: "paid", orderToken: pay.orderToken };
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
    const v = await verifyPaymentWithPayu(r.txnid);
    if (v?.status === "success" && v.amount === r.amount) {
      await markPaid(r.id, r.order_id, { mihpayid: v.mihpayid, mode: "reconciled" });
      await notifyOrder(r.order_id, "payment_received");
      result.paid++;
    } else if (v && ["failure", "failed", "userCancelled", "dropped", "bounced"].includes(v.status)) {
      await markPaymentFailed(r.id, r.order_id, `PayU: ${v.status}`);
      result.failed++;
    } else if (v?.status === "Not Found") {
      // Customer never reached PayU (closed the tab) and it's old: mark the attempt failed.
      await markPaymentFailed(r.id, r.order_id, "No payment found at PayU");
      result.failed++;
    } else result.still++; // includes PayU unreachable (v === null): try again next run
  }
  return result;
}
