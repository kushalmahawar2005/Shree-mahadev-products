import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { taxConfig } from "@/config/tax";
import { amountInWords, buildCreditLines, istDate } from "@/lib/invoice-math";
import { db } from "@/lib/server/db";
import { documentDateText, nextDocumentNumber, parseSnapshot, type InvoiceSnapshot } from "@/lib/server/invoices";

type Row = RowDataPacket & Record<string, unknown>;

const REVERSAL_REASON: Record<string, string> = {
  cancelled: "Order cancelled after invoice",
  rto: "Parcel returned to origin (RTO)",
  refunded: "Order refunded",
};

async function issue(
  conn: PoolConnection,
  invoiceRow: Row,
  invoice: InvoiceSnapshot,
  orderId: number,
  key: string,
  amount: number,
  reason: string,
  refundId: number | null,
  now: Date,
) {
  const { lines, totals } = buildCreditLines(invoice.lines, amount, { intraState: invoice.intraState });
  const number = await nextDocumentNumber(conn, "credit_note_sequences", taxConfig.creditNotePrefix, now);
  const noteDate = istDate(now);
  const snapshot: InvoiceSnapshot = {
    ...invoice,
    kind: "credit_note",
    invoiceNo: number.number,
    financialYear: number.fy,
    invoiceDate: noteDate,
    invoiceDateText: documentDateText(noteDate),
    documentTitle: "Credit note",
    lines,
    totals,
    amountInWords: amountInWords(totals.grandTotal),
    against: { invoiceNo: invoice.invoiceNo, invoiceDate: invoice.invoiceDateText, reason },
    signatureImageUrl: taxConfig.signatureImageUrl,
  };
  await conn.execute(
    `INSERT INTO credit_notes (invoice_id, order_id, credit_note_no, fy, seq, note_date, source_key, refund_id, amount, reason, snapshot)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [invoiceRow.id, orderId, number.number, number.fy, number.seq, noteDate, key, refundId, Math.round(totals.grandTotal), reason.slice(0, 255), JSON.stringify(snapshot)],
  );
}

/**
 * Issue any missing credit notes for an invoiced order (idempotent, one per source event):
 * each successful refund → its amount; a refunded return without a PayU refund → the returned
 * items' value; cancelled / RTO / refunded orders → whatever of the invoice is still uncredited.
 * Total credit never exceeds the invoice. Orders without an invoice get nothing.
 */
export async function ensureCreditNotesForOrder(orderId: number): Promise<{ id: number; number: string; amount: number }[]> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.execute<Row[]>("SELECT id, status, discount, subtotal FROM orders WHERE id=? FOR UPDATE", [orderId]);
    const [[invoiceRow]] = order
      ? await conn.execute<Row[]>("SELECT id, snapshot FROM invoices WHERE order_id=? FOR UPDATE", [orderId])
      : [[undefined]];
    const invoice = invoiceRow ? parseSnapshot(invoiceRow.snapshot) : null;
    if (!order || !invoiceRow || !invoice) { await conn.commit(); return []; }

    const [existing] = await conn.execute<Row[]>("SELECT source_key, amount FROM credit_notes WHERE order_id=?", [orderId]);
    const keys = new Set(existing.map((r) => String(r.source_key)));
    let remaining = Math.round(invoice.totals.grandTotal) - existing.reduce((sum, r) => sum + Number(r.amount), 0);
    const now = new Date();

    const [refunds] = await conn.execute<Row[]>("SELECT id, amount, reason FROM refunds WHERE order_id=? AND status='success' ORDER BY id", [orderId]);
    for (const refund of refunds) {
      const key = `refund:${refund.id}`;
      if (keys.has(key) || remaining <= 0) continue;
      const amount = Math.min(Number(refund.amount), remaining);
      await issue(conn, invoiceRow, invoice, orderId, key, amount, `Refund${refund.reason ? `: ${String(refund.reason)}` : ""}`, Number(refund.id), now);
      keys.add(key); remaining -= amount;
    }

    if (!refunds.length && remaining > 0) {
      const [[ret]] = await conn.execute<Row[]>("SELECT id, items, reason FROM order_returns WHERE order_id=? AND status='refunded'", [orderId]);
      const key = ret ? `return:${ret.id}` : "";
      if (ret && !keys.has(key)) {
        const wanted = (typeof ret.items === "string" ? JSON.parse(ret.items) : ret.items) as { variantKey: string; qty: number }[];
        const [items] = await conn.execute<Row[]>("SELECT variant_key, unit_price FROM order_items WHERE order_id=?", [orderId]);
        const price = new Map(items.map((i) => [String(i.variant_key), Number(i.unit_price)]));
        const gross = wanted.reduce((sum, w) => sum + (price.get(w.variantKey) ?? 0) * Number(w.qty), 0);
        // Order discount shared in proportion to the returned value.
        const net = Number(order.subtotal) > 0 ? Math.round(gross * (1 - Number(order.discount) / Number(order.subtotal))) : gross;
        const amount = Math.min(net, remaining);
        if (amount > 0) {
          await issue(conn, invoiceRow, invoice, orderId, key, amount, `Goods returned: ${String(ret.reason)}`, null, now);
          keys.add(key); remaining -= amount;
        }
      }
    }

    const status = String(order.status);
    const reversalKey = `order:${status}`;
    if (REVERSAL_REASON[status] && remaining > 0 && !keys.has(reversalKey)) {
      await issue(conn, invoiceRow, invoice, orderId, reversalKey, remaining, REVERSAL_REASON[status], null, now);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  const [rows] = await db().execute<Row[]>("SELECT id, credit_note_no, amount FROM credit_notes WHERE order_id=? ORDER BY id", [orderId]);
  return rows.map((r) => ({ id: Number(r.id), number: String(r.credit_note_no), amount: Number(r.amount) }));
}

/** A saved credit note (latest when no id is given). */
export async function readCreditNote(orderId: number, id?: number): Promise<InvoiceSnapshot | null> {
  const [[row]] = id
    ? await db().execute<Row[]>("SELECT snapshot FROM credit_notes WHERE order_id=? AND id=?", [orderId, id])
    : await db().execute<Row[]>("SELECT snapshot FROM credit_notes WHERE order_id=? ORDER BY id DESC LIMIT 1", [orderId]);
  return row ? parseSnapshot(row.snapshot) : null;
}
