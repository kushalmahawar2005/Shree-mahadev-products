import "server-only";
import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { notifyOrder } from "./mail";
import { addOrderNote, flagOrder, inTx, setOrderStatus, type OrderStatus } from "./orders";
import { requestPayuRefund } from "./payu";

/** Statuses where nothing has left the warehouse yet: a full refund here also cancels + restocks. */
const NOT_DISPATCHED: readonly OrderStatus[] = ["paid", "confirmed", "packed"];

/**
 * Full or partial PayU refund, safe against double clicks, two tabs and retries:
 * 1. In one transaction (order row locked): recompute what is still refundable from the DB and
 *    record a `requested` refund row. A concurrent request waits for the lock, then sees that row
 *    counted against the balance, so the same money can't be refunded twice.
 * 2. Commit, then call PayU (never while holding the lock).
 * 3. Record the result with a conditional update. If PayU's answer is unclear (timeout / network),
 *    the row stays `requested` (still blocks a second refund) and the order is flagged for an admin.
 */
export async function refundOrder(orderId: number, amount: number, reason: string, by: string) {
  if (!Number.isInteger(amount) || amount < 1) throw new Error("Enter a refund amount of at least ₹1");

  const claim = await inTx(async (conn) => {
    const [[order]] = await conn.execute<RowDataPacket[]>(
      "SELECT status FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    if (!order) throw new Error("Order not found");
    const [[pay]] = await conn.execute<RowDataPacket[]>(
      "SELECT id, amount, mihpayid FROM payments WHERE order_id = ? AND status = 'success' ORDER BY id DESC LIMIT 1",
      [orderId],
    );
    if (!pay) throw new Error("No successful online payment on this order");
    if (!pay.mihpayid) throw new Error("PayU payment id missing; refund from the PayU dashboard");
    const [[done]] = await conn.execute<RowDataPacket[]>(
      "SELECT COALESCE(SUM(amount),0) AS n FROM refunds WHERE order_id = ? AND status IN ('requested','success')",
      [orderId],
    );
    const left = Number(pay.amount) - Number(done.n);
    if (amount > left) throw new Error(left > 0 ? `You can refund up to ₹${left}` : "This order is already fully refunded (or a refund is still in progress)");

    const token = `SMPR${orderId}T${Date.now().toString(36)}${randomBytes(2).toString("hex")}`.slice(0, 40);
    const [ins] = await conn.execute<ResultSetHeader>(
      "INSERT INTO refunds (order_id, payment_id, amount, reason, token, created_by) VALUES (?,?,?,?,?,?)",
      [orderId, pay.id, amount, reason.slice(0, 255) || null, token, by],
    );
    return {
      refundId: ins.insertId,
      token,
      mihpayid: String(pay.mihpayid),
      full: amount === left,
      orderStatus: String(order.status) as OrderStatus,
    };
  });

  const res = await requestPayuRefund(claim.mihpayid, claim.token, amount);

  if (!res.ok && res.uncertain) {
    // Keep the row `requested`: it still counts against the balance, so nobody can refund again
    // until an admin checks PayU and resolves the flag.
    await flagOrder(
      db(),
      orderId,
      `Refund ₹${amount} (${claim.token}) sent to PayU but no clear answer (${res.message.slice(0, 120)}). Check the PayU dashboard before refunding again.`,
      "admin",
    );
    throw new Error("PayU did not answer in time. The refund is on hold: check the PayU dashboard, then resolve the flag on this order.");
  }

  const [upd] = await db().execute<ResultSetHeader>(
    "UPDATE refunds SET status = ?, provider_ref = ?, error = ? WHERE id = ? AND status = 'requested'",
    [res.ok ? "success" : "failed", res.ref ?? null, res.ok ? null : res.message.slice(0, 255), claim.refundId],
  );
  if (!res.ok) throw new Error(res.message);
  if (!upd.affectedRows) return { amount, full: claim.full }; // already recorded by another path

  const note = `Refund ₹${amount}${reason ? `: ${reason}` : ""} (PayU ${res.ref ?? ""})`.trim();
  // A full refund of an order that never left the warehouse also puts its stock back.
  const restock = claim.full && NOT_DISPATCHED.includes(claim.orderStatus) && !(await hasLiveShipment(orderId));
  const moved = await setOrderStatus(orderId, claim.full ? "refunded" : "partially_refunded", "admin", note, { restock });
  // A second partial refund leaves the status as it is: still record it in the order timeline.
  if (!moved) await addOrderNote(orderId, "admin", note);
  await notifyOrder(orderId, "refund", { refundAmount: amount });
  return { amount, full: claim.full };
}

async function hasLiveShipment(orderId: number) {
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT 1 FROM shipments WHERE order_id = ? AND status <> 'cancelled' LIMIT 1",
    [orderId],
  );
  return rows.length > 0;
}
