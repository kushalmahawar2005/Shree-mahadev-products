import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { notifyOrder } from "./mail";
import { refundableFor, setOrderStatus } from "./orders";
import { requestPayuRefund } from "./payu";

/** Full or partial PayU refund. Records the request first so a double click can't refund twice. */
export async function refundOrder(orderId: number, amount: number, reason: string, by: string) {
  const r = await refundableFor(orderId);
  if (!r) throw new Error("No successful online payment on this order");
  if (!r.mihpayid) throw new Error("PayU payment id missing; refund from the PayU dashboard");
  if (amount < 1 || amount > r.left) throw new Error(`You can refund up to ₹${r.left}`);

  const token = `SMPR${orderId}T${Date.now().toString(36)}${randomBytes(2).toString("hex")}`.slice(0, 40);
  const [ins] = await db().execute<import("mysql2").ResultSetHeader>(
    "INSERT INTO refunds (order_id, payment_id, amount, reason, token, created_by) VALUES (?,?,?,?,?,?)",
    [orderId, r.paymentId, amount, reason.slice(0, 255) || null, token, by],
  );
  const res = await requestPayuRefund(r.mihpayid, token, amount);
  await db().execute("UPDATE refunds SET status = ?, provider_ref = ?, error = ? WHERE id = ?", [
    res.ok ? "success" : "failed",
    res.ref ?? null,
    res.ok ? null : res.message.slice(0, 255),
    ins.insertId,
  ]);
  if (!res.ok) throw new Error(res.message);

  const full = amount === r.left;
  await setOrderStatus(orderId, full ? "refunded" : "partially_refunded", "admin", `Refund ₹${amount}${reason ? `: ${reason}` : ""} (PayU ${res.ref ?? ""})`.trim());
  await notifyOrder(orderId, "refund", { refundAmount: amount });
  return { amount, full };
}
