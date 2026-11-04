import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";
import { DEFAULT_SETTINGS, StoreSettingsSchema } from "@/lib/store-settings";

type LineInput = {
  title: string;
  size: string;
  sku: string | null;
  hsn: string | null;
  gstRate: number | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type InvoiceLine = LineInput & {
  discount: number;
  taxableValue: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type InvoiceSnapshot = {
  invoiceNo: string;
  financialYear: string;
  invoiceDate: string;
  documentTitle: "Tax invoice" | "Bill of supply";
  supplyState: string;
  intraState: boolean;
  pricesIncludeGst: boolean;
  seller: { legalName: string; address: string; gstin: string; fssai: string; phone: string; email: string };
  buyer: { name: string; address: string; phone: string; email: string; state: string; pincode: string };
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  taxTotal: number;
  total: number;
  amountInWords: string;
};

export class MissingTaxDetailsError extends Error {
  constructor(handles: string[]) {
    super(`Add an HSN code and GST rate to these products before issuing the invoice: ${handles.join(", ")}`);
    this.name = "MissingTaxDetailsError";
  }
}

export function financialYearFor(date: Date) {
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  const start = month >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function underThousand(n: number): string {
  if (n < 20) return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` ${underThousand(n % 100)}` : ""}`;
}

export function amountInWords(amount: number) {
  let n = Math.max(0, Math.floor(amount));
  if (n === 0) return "Zero rupees only";
  const groups: [number, string][] = [[10_000_000, "crore"], [100_000, "lakh"], [1_000, "thousand"], [1, ""]];
  const words: string[] = [];
  for (const [base, name] of groups) {
    const units = Math.floor(n / base);
    if (units) { words.push(`${underThousand(units)}${name ? ` ${name}` : ""}`); n %= base; }
  }
  return `${words.join(" ").replace(/\s+/g, " ")} rupees only`.replace(/^./, (c) => c.toUpperCase());
}

function issueDateText(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function calculateInvoiceLines(
  input: LineInput[],
  options: { gstRegistered: boolean; intraState: boolean; pricesIncludeGst: boolean; discount: number; subtotal: number },
) {
  if (options.gstRegistered) {
    const missing = input.filter((line) => !line.hsn || line.gstRate === null).map((line) => line.title);
    if (missing.length) throw new MissingTaxDetailsError([...new Set(missing)]);
  }
  let discountLeft = Math.min(options.discount, options.subtotal);
  let taxTotal = 0;
  const lines = input.map((line, index) => {
    const share = index === input.length - 1
      ? discountLeft
      : options.subtotal > 0 ? Math.min(discountLeft, Math.round(options.discount * line.lineTotal / options.subtotal)) : 0;
    discountLeft -= share;
    const adjusted = Math.max(0, line.lineTotal - share);
    const rate = options.gstRegistered ? (line.gstRate ?? 0) : 0;
    const taxableValue = options.gstRegistered && options.pricesIncludeGst
      ? Math.round(adjusted * 100 / (100 + rate))
      : adjusted;
    const taxAmount = options.gstRegistered
      ? options.pricesIncludeGst ? adjusted - taxableValue : Math.round(taxableValue * rate / 100)
      : 0;
    const cgst = options.intraState ? Math.floor(taxAmount / 2) : 0;
    const sgst = options.intraState ? taxAmount - cgst : 0;
    const igst = options.intraState ? 0 : taxAmount;
    taxTotal += taxAmount;
    return { ...line, discount: share, taxableValue, taxAmount, cgst, sgst, igst };
  });
  return { lines, taxTotal };
}

type InvoiceRow = RowDataPacket & Record<string, unknown>;
const eligible = new Set(["cod_pending", "paid", "confirmed", "packed", "shipped", "delivered"]);
const json = (value: unknown): InvoiceSnapshot | null => {
  if (!value) return null;
  if (typeof value === "string") { try { return JSON.parse(value) as InvoiceSnapshot; } catch { return null; } }
  return value as InvoiceSnapshot;
};

async function invoiceSettings(conn: PoolConnection) {
  const [rows] = await conn.query<InvoiceRow[]>("SELECT `key`, value FROM settings WHERE `key` IN ('business','prices_include_gst')");
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
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

async function nextInvoiceNumber(conn: PoolConnection, date: Date) {
  const fy = financialYearFor(date);
  await conn.execute("INSERT IGNORE INTO invoice_sequences (fy, next_seq) VALUES (?,1)", [fy]);
  const [[sequence]] = await conn.execute<InvoiceRow[]>("SELECT next_seq FROM invoice_sequences WHERE fy=? FOR UPDATE", [fy]);
  const seq = Number(sequence.next_seq);
  await conn.execute("UPDATE invoice_sequences SET next_seq=? WHERE fy=?", [seq + 1, fy]);
  return { fy, seq, invoiceNo: `SMP/${fy}/${String(seq).padStart(4, "0")}` };
}

/** Assigns one immutable invoice snapshot per eligible order. Sequence allocation and insert are serialized per FY. */
export async function ensureInvoiceForOrder(orderId: number): Promise<InvoiceSnapshot> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.execute<InvoiceRow[]>(
      `SELECT id, order_no, token, status, payment_method, customer_name, phone, email, address_line1, address_line2,
              city, state, pincode, subtotal, discount, shipping, cod_fee, total
       FROM orders WHERE id=? FOR UPDATE`, [orderId],
    );
    if (!order) throw new Error("Order not found");
    if (!eligible.has(String(order.status))) throw new Error("An invoice is available after the order is placed or paid");
    const [[existing]] = await conn.execute<InvoiceRow[]>("SELECT snapshot FROM invoices WHERE order_id=? FOR UPDATE", [orderId]);
    if (existing) {
      const snapshot = json(existing.snapshot);
      if (snapshot) { await conn.commit(); return snapshot; }
    }

    const settings = await invoiceSettings(conn);
    const [rows] = await conn.execute<InvoiceRow[]>(
      `SELECT oi.product_title, oi.variant_title, oi.sku, oi.quantity, oi.unit_price, oi.line_total,
              p.hsn, p.gst_rate
       FROM order_items oi LEFT JOIN products p ON p.handle=oi.product_handle
       WHERE oi.order_id=? ORDER BY oi.id`, [orderId],
    );
    const sourceLines: LineInput[] = rows.map((row) => ({
      title: String(row.product_title), size: String(row.variant_title), sku: row.sku ? String(row.sku) : null,
      hsn: row.hsn === null ? null : String(row.hsn), gstRate: row.gst_rate === null ? null : Number(row.gst_rate),
      quantity: Number(row.quantity), unitPrice: Number(row.unit_price), lineTotal: Number(row.line_total),
    }));
    const sellerState = settings.business.state.trim().toLowerCase();
    const buyerState = String(order.state).trim().toLowerCase();
    const gstRegistered = !!settings.business.gstin;
    const tax = calculateInvoiceLines(sourceLines, {
      gstRegistered, intraState: sellerState === buyerState, pricesIncludeGst: settings.pricesIncludeGst,
      discount: Number(order.discount), subtotal: Number(order.subtotal),
    });
    const now = new Date();
    const number = await nextInvoiceNumber(conn, now);
    const invoiceTotal = Number(order.total) + (gstRegistered && !settings.pricesIncludeGst ? tax.taxTotal : 0);
    const snapshot: InvoiceSnapshot = {
      invoiceNo: number.invoiceNo,
      financialYear: number.fy,
      invoiceDate: issueDateText(now),
      documentTitle: gstRegistered ? "Tax invoice" : "Bill of supply",
      supplyState: String(order.state),
      intraState: sellerState === buyerState,
      pricesIncludeGst: settings.pricesIncludeGst,
      seller: {
        legalName: settings.business.legalName, address: [settings.business.addressLine1, settings.business.city,
          settings.business.district && `Dist. ${settings.business.district}`, settings.business.state, settings.business.postalCode].filter(Boolean).join(", "),
        gstin: settings.business.gstin, fssai: settings.business.fssai, phone: settings.business.phone, email: settings.business.email,
      },
      buyer: {
        name: String(order.customer_name),
        address: [order.address_line1, order.address_line2, `${order.city}, ${order.state} ${order.pincode}`].filter(Boolean).join(", "),
        phone: String(order.phone), email: String(order.email ?? ""), state: String(order.state), pincode: String(order.pincode),
      },
      lines: tax.lines,
      subtotal: Number(order.subtotal), discount: Number(order.discount), shipping: Number(order.shipping), codFee: Number(order.cod_fee),
      taxTotal: tax.taxTotal, total: invoiceTotal, amountInWords: amountInWords(invoiceTotal),
    };
    await conn.execute("INSERT INTO invoices (order_id, invoice_no, fy, seq, snapshot) VALUES (?,?,?,?,?)", [orderId, number.invoiceNo, number.fy, number.seq, JSON.stringify(snapshot)]);
    await conn.commit();
    return snapshot;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function readInvoice(orderId: number) {
  const [[row]] = await db().execute<InvoiceRow[]>("SELECT snapshot FROM invoices WHERE order_id=?", [orderId]);
  return json(row?.snapshot);
}
