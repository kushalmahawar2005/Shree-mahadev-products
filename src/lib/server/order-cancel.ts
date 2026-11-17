import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { cancelRule, PAID_CANCEL_MESSAGE } from "@/components/account/help/help-lib";
import { db } from "./db";
import { flagOrder, hasActiveShipment, setOrderStatus } from "./orders";
import { createSupportTicket, queueSupportAlert } from "./support-tickets";

export type CancelResult =
  | { ok: true }
  | { ok: false; error: string; canRequest?: boolean };

async function ownOrder(customerId: number, orderId: number) {
  const [[o]] = await db().query<RowDataPacket[]>(
    "SELECT status, payment_method, order_no FROM orders WHERE id=? AND customer_id=?",
    [orderId, customerId],
  );
  return o ? { status: String(o.status), method: String(o.payment_method), orderNo: String(o.order_no) } : null;
}

/**
 * Shopper cancels their own order. Paid online orders are never cancelled here (they need a refund):
 * the shopper gets `canRequest` and sends a cancel request instead. The status move itself is locked
 * and only applies from the statuses the rule allows, so a payment or shipment landing in between wins.
 */
export async function customerCancelOrder(customerId: number, orderId: number, reason: string): Promise<CancelResult> {
  const o = await ownOrder(customerId, orderId);
  if (!o) return { ok: false, error: "Order not found." };
  const rule = cancelRule(o.status, o.method, await hasActiveShipment(orderId));
  if (!rule.ok) return { ok: false, error: rule.reason, canRequest: rule.canRequest };
  const changed = await setOrderStatus(orderId, "cancelled", "customer", `Cancelled by customer: ${reason}`, {
    onlyFrom: o.method === "payu" ? ["pending_payment", "payment_failed"] : ["cod_pending", "confirmed", "packed", "pending_payment"],
  });
  if (!changed) return { ok: false, error: "This order changed just now. Refresh the page and try again." };
  return { ok: true };
}

/**
 * Paid online order: the shopper asks the team to cancel + refund. Creates a help ticket (same queue as
 * /account/help) and flags the order on the admin page. Repeat taps reuse the open request.
 */
export async function requestOrderCancel(customerId: number, orderId: number, reason: string): Promise<{ ok: true; ticketNo: string } | { ok: false; error: string }> {
  const o = await ownOrder(customerId, orderId);
  if (!o) return { ok: false, error: "Order not found." };
  const rule = cancelRule(o.status, o.method, await hasActiveShipment(orderId));
  if (rule.ok || !rule.canRequest) return { ok: false, error: rule.ok ? "You can cancel this order yourself." : rule.reason };

  const [[open]] = await db().query<RowDataPacket[]>(
    "SELECT ticket_no FROM support_tickets WHERE order_id=? AND customer_id=? AND issue='cancel' AND status<>'resolved' ORDER BY id DESC LIMIT 1",
    [orderId, customerId],
  );
  if (open?.ticket_no) return { ok: true, ticketNo: String(open.ticket_no) };

  const t = await createSupportTicket({
    customerId,
    orderId,
    issue: "cancel",
    message: `Cancel + refund request (paid online). Reason: ${reason}`.slice(0, 500),
    utr: null,
    contactPref: "whatsapp",
    callbackSlot: null,
    photos: [],
  });
  const [[c]] = await db().query<RowDataPacket[]>("SELECT name, phone FROM customers WHERE id=?", [customerId]);
  await queueSupportAlert({
    ticketId: t.id,
    ticketNo: t.ticketNo,
    customer: { name: String(c?.name ?? ""), phone: String(c?.phone ?? "") },
    orderId,
    orderNo: o.orderNo,
    issue: "cancel",
    message: `Cancel + refund request (paid online). Reason: ${reason}`,
    utr: null,
    contactPref: "whatsapp",
    callbackSlot: null,
    photos: [],
  }).catch((e) => console.error("Cancel request alert", e));
  await flagOrder(db(), orderId, `Customer asked to cancel this paid order (${t.ticketNo}): ${reason}. Cancel + refund it, or call them.`, "customer");
  return { ok: true, ticketNo: t.ticketNo };
}

export { PAID_CANCEL_MESSAGE };
