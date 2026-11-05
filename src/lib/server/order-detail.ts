import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { PLACED } from "./dashboard";

type Rows = RowDataPacket[];

export type PaymentAttempt = {
  id: number;
  txnid: string;
  amount: number;
  status: string; // initiated | success | failed | pending | refunded
  mode: string | null;
  mihpayid: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderInvoice = { invoiceNo: string; createdAt: string } | null;

export type CustomerSummary = {
  orders: number;
  spent: number;
  firstOrderAt: string | null;
  customerId: number | null;
  recent: { id: number; orderNo: string; status: string; total: number; createdAt: string }[];
};

/** Everything the admin order page shows beyond the order row itself, in parallel. */
export async function getOrderExtras(order: { id: number; address: { phone: string } }) {
  const [[payments], [invoices], [history]] = await Promise.all([
    db().query<Rows>(
      "SELECT id, txnid, amount, status, mode, mihpayid, error, created_at, updated_at FROM payments WHERE order_id = ? ORDER BY id DESC",
      [order.id],
    ),
    db().query<Rows>("SELECT invoice_no, created_at FROM invoices WHERE order_id = ? LIMIT 1", [order.id]),
    db().query<Rows>(
      "SELECT id, order_no, status, total, created_at, customer_id FROM orders WHERE phone = ? ORDER BY id DESC LIMIT 50",
      [order.address.phone],
    ),
  ]);

  const placed = history.filter((r) => PLACED.includes(String(r.status)));
  const customer: CustomerSummary = {
    orders: placed.length,
    spent: placed.reduce((s, r) => s + Number(r.total), 0),
    firstOrderAt: history.length ? String(history[history.length - 1].created_at) : null,
    customerId: (history.find((r) => r.customer_id)?.customer_id as number | undefined) ?? null,
    recent: history
      .filter((r) => Number(r.id) !== order.id)
      .slice(0, 4)
      .map((r) => ({ id: Number(r.id), orderNo: String(r.order_no), status: String(r.status), total: Number(r.total), createdAt: String(r.created_at) })),
  };

  return {
    payments: payments.map(
      (r): PaymentAttempt => ({
        id: Number(r.id),
        txnid: String(r.txnid),
        amount: Number(r.amount),
        status: String(r.status),
        mode: (r.mode as string | null) ?? null,
        mihpayid: (r.mihpayid as string | null) ?? null,
        error: (r.error as string | null) ?? null,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }),
    ),
    invoice: invoices[0] ? { invoiceNo: String(invoices[0].invoice_no), createdAt: String(invoices[0].created_at) } : null,
    customer,
  };
}
