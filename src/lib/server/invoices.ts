import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { gstStateCode, taxConfig } from "@/config/tax";
import {
  amountInWords,
  buildInvoice,
  documentNumber,
  financialYearFor,
  istDate,
  principalRate,
  resolveTaxRule,
  type InvoiceLine,
  type InvoiceLineInput,
  type InvoiceTotals,
} from "@/lib/invoice-math";
import { db } from "@/lib/server/db";
import { DEFAULT_SETTINGS, StoreSettingsSchema } from "@/lib/store-settings";

export { amountInWords, financialYearFor, type InvoiceLine };

export type Party = { name: string; address: string; phone: string; email: string; state: string; stateCode: string; pincode: string; gstin: string };

/** Immutable document saved once at issue; the PDF is always rendered from this. */
export type InvoiceSnapshot = {
  version: 2;
  kind: "invoice" | "credit_note";
  /** Invoice number, or the credit note number for kind "credit_note". */
  invoiceNo: string;
  financialYear: string;
  /** YYYY-MM-DD (IST). */
  invoiceDate: string;
  invoiceDateText: string;
  documentTitle: "Tax invoice" | "Bill of supply" | "Credit note";
  gstRegistered: boolean;
  order: { orderNo: string; orderDate: string; paymentMode: string; paymentRef: string };
  placeOfSupply: { state: string; code: string };
  intraState: boolean;
  pricesIncludeGst: boolean;
  seller: { legalName: string; address: string; gstin: string; fssai: string; phone: string; email: string; state: string; stateCode: string };
  billTo: Party;
  shipTo: Party;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  amountInWords: string;
  /** Credit notes only: the invoice they reduce and why. */
  against?: { invoiceNo: string; invoiceDate: string; reason: string };
  signatureImageUrl?: string;
  declaration: string;
};

export class MissingTaxDetailsError extends Error {
  constructor(titles: string[]) {
    super(`Add an HSN code and GST rate to these products before issuing the invoice: ${titles.join(", ")}`);
    this.name = "MissingTaxDetailsError";
  }
}

/** The order doesn't qualify for an invoice (yet): unpaid, COD not dispatched, cancelled before payment. */
export class InvoiceNotApplicableError extends Error {
  constructor(message = "The invoice is issued once the payment is received or the COD parcel is dispatched.") {
    super(message);
    this.name = "InvoiceNotApplicableError";
  }
}

type Row = RowDataPacket & Record<string, unknown>;
type Settings = Awaited<ReturnType<typeof invoiceSettings>>;

const dateText = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${ymd}T12:00:00+05:30`));

/** Sale is final: online/offline payment captured, or COD dispatched. */
export function invoiceApplicable(order: { status: string; paymentMethod: string; paidAt: string | null }) {
  if (order.paymentMethod === "cod") return taxConfig.codInvoiceStatuses.includes(order.status);
  if (order.status === "pending_payment" || order.status === "payment_failed") return false;
  return !!order.paidAt || order.paymentMethod === "offline";
}

async function invoiceSettings(conn: PoolConnection) {
  const [rows] = await conn.query<Row[]>("SELECT `key`, value FROM settings WHERE `key` IN ('business','prices_include_gst')");
  const values = new Map(rows.map((row) => {
    let value = row.value;
    if (typeof value === "string") { try { value = JSON.parse(value); } catch { /* use schema defaults */ } }
    return [String(row.key), value];
  }));
  const parsed = StoreSettingsSchema.safeParse({
    ...DEFAULT_SETTINGS,
    business: { ...DEFAULT_SETTINGS.business, ...((values.get("business") as object | undefined) ?? {}) },
    pricesIncludeGst: values.has("prices_include_gst") ? values.get("prices_include_gst") === true : true,
  });
  const settings = parsed.success ? parsed.data : DEFAULT_SETTINGS;
  const gstin = settings.business.gstin || taxConfig.sellerGstin;
  const sellerState = settings.business.state || taxConfig.sellerState;
  const sellerStateCode = (gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : "") || gstStateCode(sellerState) || taxConfig.sellerStateCode;
  return { ...settings, gstin, sellerState, sellerStateCode, fssai: settings.business.fssai || taxConfig.fssaiLicense };
}

async function nextNumber(conn: PoolConnection, table: "invoice_sequences" | "credit_note_sequences", prefix: string, date: Date) {
  const fy = financialYearFor(date);
  await conn.execute(`INSERT IGNORE INTO ${table} (fy, next_seq) VALUES (?,1)`, [fy]);
  // Row lock + same transaction as the document insert: a rollback returns the number, so no gaps.
  const [[sequence]] = await conn.execute<Row[]>(`SELECT next_seq FROM ${table} WHERE fy=? FOR UPDATE`, [fy]);
  const seq = Number(sequence.next_seq);
  await conn.execute(`UPDATE ${table} SET next_seq=? WHERE fy=?`, [seq + 1, fy]);
  return { fy, seq, number: documentNumber(prefix, fy, seq, taxConfig.numberDigits) };
}

export { nextNumber as nextDocumentNumber, dateText as documentDateText };

function sellerOf(settings: Settings): InvoiceSnapshot["seller"] {
  const b = settings.business;
  return {
    legalName: b.legalName,
    address: [b.addressLine1, b.city, b.district && `Dist. ${b.district}`, settings.sellerState, b.postalCode].filter(Boolean).join(", "),
    gstin: settings.gstin, fssai: settings.fssai, phone: b.phone, email: b.email, state: settings.sellerState, stateCode: settings.sellerStateCode,
  };
}

async function paymentOf(conn: PoolConnection, orderId: number, method: string) {
  if (method === "cod") return { paymentMode: "Cash on delivery", paymentRef: "" };
  if (method === "offline") return { paymentMode: "Paid offline", paymentRef: "" };
  const [[payment]] = await conn.execute<Row[]>(
    "SELECT txnid, mihpayid, mode, provider FROM payments WHERE order_id=? AND status IN ('success','refunded') ORDER BY id DESC LIMIT 1", [orderId],
  );
  if (!payment) return { paymentMode: "Online", paymentRef: "" };
  const gw = payment.provider === "cashfree" ? "Cashfree" : "PayU";
  // Readable mode: PayU sends UPI / CC / NB, Cashfree sends upi / net_banking / debit_card…
  const mode = payment.mode ? String(payment.mode).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "";
  return {
    paymentMode: `Online (${gw}${mode ? ` · ${mode}` : ""})`,
    paymentRef: [`Txn ${String(payment.txnid)}`, payment.mihpayid ? `${gw} ID ${String(payment.mihpayid)}` : ""].filter(Boolean).join(" · "),
  };
}

/** Old (v1) snapshots stored before the GST rework: map onto v2 so the PDF still renders. */
function normalize(raw: unknown): InvoiceSnapshot | null {
  if (!raw) return null;
  let value = raw;
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return null; } }
  const s = value as Record<string, unknown> & Partial<InvoiceSnapshot>;
  if (s.version === 2) return s as InvoiceSnapshot;
  const buyer = (s.buyer ?? {}) as Record<string, string>;
  const party: Party = { name: buyer.name ?? "", address: buyer.address ?? "", phone: buyer.phone ?? "", email: buyer.email ?? "", state: buyer.state ?? "", stateCode: gstStateCode(buyer.state ?? ""), pincode: buyer.pincode ?? "", gstin: "" };
  const lines = ((s.lines ?? []) as Record<string, unknown>[]).map((l): InvoiceLine => ({
    kind: "item", title: String(l.title ?? ""), size: String(l.size ?? ""), sku: (l.sku as string) ?? null, hsn: (l.hsn as string) ?? null,
    gstRate: Number(l.gstRate ?? 0), quantity: Number(l.quantity ?? 0), unitPrice: Number(l.unitPrice ?? 0), gross: Number(l.lineTotal ?? 0),
    discount: Number(l.discount ?? 0), taxableValue: Number(l.taxableValue ?? 0), cgst: Number(l.cgst ?? 0), sgst: Number(l.sgst ?? 0),
    igst: Number(l.igst ?? 0), taxAmount: Number(l.taxAmount ?? 0), lineTotal: Number(l.taxableValue ?? 0) + Number(l.taxAmount ?? 0),
  }));
  const sum = (key: keyof InvoiceLine) => lines.reduce((a, l) => a + Number(l[key]), 0);
  const total = Number(s.total ?? 0);
  const seller = (s.seller ?? {}) as Record<string, string>;
  return {
    version: 2, kind: "invoice", invoiceNo: String(s.invoiceNo), financialYear: String(s.financialYear ?? ""), invoiceDate: "",
    invoiceDateText: String(s.invoiceDate ?? ""), documentTitle: s.documentTitle === "Bill of supply" ? "Bill of supply" : "Tax invoice",
    gstRegistered: s.documentTitle !== "Bill of supply", order: { orderNo: "", orderDate: "", paymentMode: "", paymentRef: "" },
    placeOfSupply: { state: String(s.supplyState ?? party.state), code: party.stateCode }, intraState: !!s.intraState, pricesIncludeGst: s.pricesIncludeGst !== false,
    seller: { legalName: seller.legalName ?? "", address: seller.address ?? "", gstin: seller.gstin ?? "", fssai: seller.fssai ?? "", phone: seller.phone ?? "", email: seller.email ?? "", state: taxConfig.sellerState, stateCode: taxConfig.sellerStateCode },
    billTo: party, shipTo: party, lines,
    totals: { gross: Number(s.subtotal ?? 0), discount: Number(s.discount ?? 0), taxable: sum("taxableValue"), cgst: sum("cgst"), sgst: sum("sgst"), igst: sum("igst"), tax: sum("taxAmount"), roundOff: 0, grandTotal: total },
    amountInWords: String(s.amountInWords ?? amountInWords(total)), declaration: taxConfig.declaration,
  };
}
export { normalize as parseSnapshot };

/** Create or return an invoice inside the caller's transaction. */
async function ensureInvoiceInTransaction(conn: PoolConnection, orderId: number, now: Date, settings: Settings) {
  const [[order]] = await conn.execute<Row[]>(
    `SELECT id, order_no, status, payment_method, customer_name, phone, email, customer_gstin, address_line1, address_line2,
            city, state, pincode, subtotal, discount, shipping, cod_fee, total, paid_at, created_at
     FROM orders WHERE id=? FOR UPDATE`, [orderId],
  );
  if (!order) throw new Error("Order not found");
  const [[existing]] = await conn.execute<Row[]>("SELECT snapshot FROM invoices WHERE order_id=? FOR UPDATE", [orderId]);
  if (existing) {
    const snapshot = normalize(existing.snapshot);
    if (snapshot) return snapshot;
    throw new Error("The saved invoice snapshot is invalid; contact support before issuing another invoice");
  }
  if (!invoiceApplicable({ status: String(order.status), paymentMethod: String(order.payment_method), paidAt: order.paid_at ? String(order.paid_at) : null }))
    throw new InvoiceNotApplicableError();

  const [rows] = await conn.execute<Row[]>(
    `SELECT oi.product_handle, oi.product_title, oi.variant_title, oi.sku, oi.quantity, oi.unit_price, p.category, p.hsn, p.gst_rate
     FROM order_items oi LEFT JOIN products p ON p.handle=oi.product_handle
     WHERE oi.order_id=? ORDER BY oi.id`, [orderId],
  );
  const items: InvoiceLineInput[] = rows.map((row) => {
    const rule = resolveTaxRule(
      { handle: row.product_handle ? String(row.product_handle) : null, category: row.category ? String(row.category) : null, hsn: row.hsn ? String(row.hsn) : null, gstRate: row.gst_rate === null || row.gst_rate === undefined ? null : Number(row.gst_rate) },
      taxConfig,
    );
    return {
      kind: "item", title: String(row.product_title), size: String(row.variant_title), sku: row.sku ? String(row.sku) : null,
      hsn: rule.hsn, gstRate: rule.gstRate, quantity: Number(row.quantity), unitPrice: Number(row.unit_price),
    };
  });
  const gstRegistered = !!settings.gstin;
  if (gstRegistered) {
    const missing = items.filter((line) => !line.hsn || line.gstRate === null).map((line) => line.title);
    if (missing.length) throw new MissingTaxDetailsError([...new Set(missing)]);
  }
  const principal = principalRate(items);
  const feeRate = (rate: number | "principal") => (rate === "principal" ? principal : rate);
  if (Number(order.shipping) > 0)
    items.push({ kind: "shipping", title: "Shipping charges", size: "", sku: null, hsn: taxConfig.shipping.hsn, gstRate: feeRate(taxConfig.shipping.gstRate), quantity: 1, unitPrice: Number(order.shipping) });
  if (Number(order.cod_fee) > 0)
    items.push({ kind: "cod", title: "COD handling fee", size: "", sku: null, hsn: taxConfig.codFee.hsn, gstRate: feeRate(taxConfig.codFee.gstRate), quantity: 1, unitPrice: Number(order.cod_fee) });

  const buyerState = String(order.state);
  const buyerCode = gstStateCode(buyerState);
  const intraState = buyerCode ? buyerCode === settings.sellerStateCode : buyerState.trim().toLowerCase() === settings.sellerState.trim().toLowerCase();
  const { lines, totals } = buildInvoice(items, { gstRegistered, intraState, pricesIncludeGst: settings.pricesIncludeGst, discount: Number(order.discount) });

  const number = await nextNumber(conn, "invoice_sequences", taxConfig.invoicePrefix, now);
  const invoiceDate = istDate(now);
  const party: Party = {
    name: String(order.customer_name),
    address: [order.address_line1, order.address_line2, `${order.city}, ${order.state} ${order.pincode}`].filter(Boolean).join(", "),
    phone: String(order.phone), email: String(order.email ?? ""), state: buyerState, stateCode: buyerCode, pincode: String(order.pincode),
    gstin: String(order.customer_gstin ?? ""),
  };
  const orderDate = String(order.created_at).slice(0, 10);
  const snapshot: InvoiceSnapshot = {
    version: 2, kind: "invoice", invoiceNo: number.number, financialYear: number.fy, invoiceDate, invoiceDateText: dateText(invoiceDate),
    documentTitle: gstRegistered ? "Tax invoice" : "Bill of supply", gstRegistered,
    order: { orderNo: String(order.order_no), orderDate: dateText(orderDate), ...(await paymentOf(conn, orderId, String(order.payment_method))) },
    placeOfSupply: { state: buyerState, code: buyerCode }, intraState, pricesIncludeGst: settings.pricesIncludeGst,
    seller: sellerOf(settings), billTo: party, shipTo: party, lines, totals, amountInWords: amountInWords(totals.grandTotal),
    signatureImageUrl: taxConfig.signatureImageUrl, declaration: taxConfig.declaration,
  };
  await conn.execute(
    "INSERT INTO invoices (order_id, invoice_no, fy, seq, invoice_date, snapshot) VALUES (?,?,?,?,?,?)",
    [orderId, number.number, number.fy, number.seq, invoiceDate, JSON.stringify(snapshot)],
  );
  return snapshot;
}

/** Assigns invoices atomically. Sequence allocation and inserts roll back together if any order is invalid. */
export async function ensureInvoicesForOrders(orderIds: number[]): Promise<InvoiceSnapshot[]> {
  if (!orderIds.length || orderIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Invalid order selection");
  if (new Set(orderIds).size !== orderIds.length) throw new Error("Duplicate order selection");
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const now = new Date();
    const settings = await invoiceSettings(conn);
    const snapshots = new Map<number, InvoiceSnapshot>();
    // Stable lock order avoids deadlocks when admins request overlapping batches.
    for (const orderId of [...orderIds].sort((a, b) => a - b)) {
      snapshots.set(orderId, await ensureInvoiceInTransaction(conn, orderId, now, settings));
    }
    await conn.commit();
    return orderIds.map((id) => snapshots.get(id)!);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Idempotent: returns the existing invoice or issues the next number. Throws InvoiceNotApplicableError. */
export async function ensureInvoiceForOrder(orderId: number): Promise<InvoiceSnapshot> {
  return (await ensureInvoicesForOrders([orderId]))[0];
}

/** For status hooks: issue the invoice if the order qualifies now, otherwise do nothing. */
export async function ensureInvoiceIfApplicable(orderId: number): Promise<InvoiceSnapshot | null> {
  try {
    return await ensureInvoiceForOrder(orderId);
  } catch (error) {
    if (error instanceof InvoiceNotApplicableError) return null;
    throw error;
  }
}

export async function readInvoice(orderId: number) {
  const [[row]] = await db().execute<Row[]>("SELECT snapshot FROM invoices WHERE order_id=?", [orderId]);
  return normalize(row?.snapshot);
}

/**
 * Invoice + credit note summary for the order UI. Dates are "YYYY-MM-DD" (IST).
 * `applicable` = the order qualifies for an invoice now (the download route issues it on demand).
 */
export async function invoiceInfoForOrder(orderId: number): Promise<{
  invoice: { number: string; date: string } | null;
  creditNotes: { id: number; number: string; date: string; amount: number }[];
  applicable: boolean;
}> {
  const [[[order]], [[invoice]], [notes]] = await Promise.all([
    db().execute<Row[]>("SELECT status, payment_method, paid_at FROM orders WHERE id=?", [orderId]),
    db().execute<Row[]>("SELECT invoice_no, invoice_date FROM invoices WHERE order_id=?", [orderId]),
    db().execute<Row[]>("SELECT id, credit_note_no, note_date, amount FROM credit_notes WHERE order_id=? ORDER BY id", [orderId]),
  ]);
  if (!order) return { invoice: null, creditNotes: [], applicable: false };
  return {
    invoice: invoice ? { number: String(invoice.invoice_no), date: String(invoice.invoice_date).slice(0, 10) } : null,
    creditNotes: notes.map((n) => ({ id: Number(n.id), number: String(n.credit_note_no), date: String(n.note_date).slice(0, 10), amount: Number(n.amount) })),
    applicable: !!invoice || invoiceApplicable({ status: String(order.status), paymentMethod: String(order.payment_method), paidAt: order.paid_at ? String(order.paid_at) : null }),
  };
}

/** "SMP/2026-27/000123" → "Invoice-SMP-2026-27-000123.pdf". */
export function pdfFileName(kind: "Invoice" | "Credit-Note", number: string) {
  return `${kind}-${number.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}
