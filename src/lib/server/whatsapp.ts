import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";

type Rows = RowDataPacket[];
const BACKOFF = [1, 5, 15, 60, 240];
const phone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits.replace(/^00/, "");
};

/** "meta" = WhatsApp Cloud API direct (token + phone number ID); anything else = generic JSON relay at WHATSAPP_API_URL. */
const isMeta = () => process.env.WHATSAPP_PROVIDER === "meta";
export const whatsappConfigured = () =>
  isMeta()
    ? Boolean(process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_PHONE_NUMBER_ID)
    : Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_API_URL);

async function enabled(template: string) {
  const [[row]] = await db().query<Rows>(
    "SELECT enabled FROM whatsapp_templates WHERE template = ?",
    [template],
  );
  return row ? Boolean(row.enabled) : true;
}

async function optedOut(to: string) {
  const [[row]] = await db().query<Rows>(
    "SELECT phone FROM whatsapp_optouts WHERE phone = ?",
    [to],
  );
  return Boolean(row);
}

async function queue(
  template: string,
  toPhone: string,
  payload: Record<string, unknown>,
  opts: { orderId?: number; cartId?: number; dedupe: string },
) {
  const to = phone(toPhone);
  if (!to || await optedOut(to) || !(await enabled(template))) return false;
  const [result] = await db().execute<ResultSetHeader>(
    `INSERT IGNORE INTO whatsapp_outbox
      (order_id, cart_id, template, to_phone, payload, dedupe_key)
      VALUES (?,?,?,?,?,?)`,
    [opts.orderId ?? null, opts.cartId ?? null, template, to, JSON.stringify(payload), opts.dedupe],
  );
  return result.affectedRows > 0;
}

export type OrderTemplate =
  | "order_placed"
  | "cod_confirmation"
  | "shipped"
  | "out_for_delivery"
  | "delivery_failed"
  | "delivered"
  | "cancelled"
  | "payment_pending";

/** `dedupeSuffix`: lets a message repeat (e.g. one "delivery failed" per day), default once per order. */
export async function queueOrderWhatsApp(orderId: number, template: OrderTemplate, dedupeSuffix = "") {
  const [[order]] = await db().query<Rows>(
    `SELECT o.id, o.order_no, o.token, o.customer_name, o.phone, o.total, o.payment_method, o.status,
            s.awb, s.tracking_url
     FROM orders o
     LEFT JOIN shipments s ON s.id = (
       SELECT MAX(s2.id) FROM shipments s2 WHERE s2.order_id = o.id
     )
     WHERE o.id = ?`,
    [orderId],
  );
  if (!order) return false;
  return queue(template, String(order.phone), {
    orderNo: order.order_no,
    name: order.customer_name,
    total: order.total,
    status: order.status,
    paymentMethod: order.payment_method,
    awb: order.awb ?? null,
    trackingUrl: order.tracking_url ?? null,
    orderUrl: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/order?t=${order.token}`,
    reviewUrl: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/review?t=${order.token}`,
    payUrl: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/checkout/pay?t=${order.token}`,
    trackUrl: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/track-order?t=${order.token}`,
    supportPhone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  }, { orderId, dedupe: `${template}:${orderId}${dedupeSuffix ? `:${dedupeSuffix}` : ""}` });
}

/** `bump` false: the caller counts the reminder (cron sends WhatsApp + email as one reminder). */
export async function queueCartWhatsApp(cartId: number, template: "abandoned_cart_1h" | "abandoned_cart_24h", bump = true) {
  const [[cart]] = await db().query<Rows>(
    "SELECT id, token, name, phone FROM carts WHERE id = ? AND status = 'active'",
    [cartId],
  );
  if (!cart?.phone) return false;
  const [items] = await db().query<Rows>(
    "SELECT product_title, variant_title, quantity FROM cart_items WHERE cart_id = ?",
    [cartId],
  );
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const sent = await queue(template, String(cart.phone), {
    name: cart.name,
    items: items.map((item) => `${item.quantity} × ${item.product_title} (${item.variant_title})`),
    recoveryUrl: `${base}/cart/recover/${cart.token}`,
    optOut: "Reply STOP to opt out.",
  }, { cartId, dedupe: `${template}:${cartId}` });
  if (sent && bump) await db().execute("UPDATE carts SET reminder_count = reminder_count + 1, reminder_sent_at = NOW() WHERE id = ?", [cartId]);
  return sent;
}

export async function queueBackInStock(phoneNumber: string, variantKey: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const [[item]] = await db().query<Rows>(
    `SELECT p.handle, p.title, v.title AS variant FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.variant_key = ?`,
    [variantKey],
  );
  return queue("back_in_stock", phoneNumber, {
    variantKey,
    productName: item ? `${item.title}${item.variant ? ` (${item.variant})` : ""}` : "Your item",
    productUrl: item ? `${base}/products/${item.handle}` : `${base}/shop`,
    shopUrl: `${base}/shop`,
  }, { dedupe: `back_in_stock:${variantKey}:${phone(phoneNumber)}` });
}

export function message(template: string, payload: Record<string, unknown>) {
  const name = String(payload.name ?? "there");
  const order = payload.orderNo ? ` for order ${payload.orderNo}` : "";
  const common = `Namaste ${name}, this is Swadeshi Mahadev Products.`;
  switch (template) {
    case "cod_confirmation": return `${common} Please reply YES to confirm your COD order${order}, or NO to cancel.`;
    case "shipped": return `${common} Your order${order} has shipped. AWB: ${payload.awb ?? "available in your tracking page"}.`;
    case "out_for_delivery": return `${common} Your order${order} is out for delivery today. ${payload.paymentMethod === "cod" ? `Please keep ₹${payload.total} ready. ` : ""}Track it: ${payload.trackUrl}`;
    case "delivery_failed": return `${common} The courier could not deliver your order${order} today. Reply here with a good time or an updated address/phone and we will arrange the next attempt. Track it: ${payload.trackUrl}`;
    case "payment_pending": return `${common} Your order${order} is saved, but the payment did not go through. Complete it here (₹${payload.total}): ${payload.payUrl}\nIf money was deducted, please don't pay again; it updates on its own.`;
    case "delivered": return `${common} Your order${order} was delivered. We would love your feedback: ${payload.reviewUrl}`;
    case "cancelled": return `${common} Your order${order} has been cancelled.`;
    case "abandoned_cart_1h":
    case "abandoned_cart_24h": return `${common} You left items in your cart. Complete your order here: ${payload.recoveryUrl}\n${payload.optOut}`;
    case "back_in_stock": return `${common} An item you wanted is back in stock: ${payload.shopUrl}\n${payload.optOut}`;
    default: return `${common} We received your order${order}. Total: ₹${payload.total}. Track it here: ${payload.orderUrl}`;
  }
}

/** What each automation says, with sample values (admin Messages page shows it under each toggle). */
const SAMPLE = {
  name: "Priya",
  orderNo: "SMP1001",
  total: 1062,
  paymentMethod: "cod",
  awb: "1234567890",
  orderUrl: "swadeshimahadevproducts.in/order?t=…",
  reviewUrl: "swadeshimahadevproducts.in/review?t=…",
  payUrl: "swadeshimahadevproducts.in/checkout/pay?t=…",
  trackUrl: "swadeshimahadevproducts.in/track-order?t=…",
  recoveryUrl: "swadeshimahadevproducts.in/cart/recover/…",
  shopUrl: "swadeshimahadevproducts.in/shop",
  optOut: "Reply STOP to opt out.",
};
export const previewMessage = (template: string) => message(template, SAMPLE);

/**
 * Body variables for each approved Meta template, in {{1}}, {{2}}… order (see the template list in
 * WhatsApp Manager). Amounts go without "₹" (the template has it). Meta rejects empty values and
 * newlines/tabs inside a variable, so every value is cleaned.
 */
function metaParams(template: string, p: Record<string, unknown>): string[] {
  const name = String(p.name ?? "").trim().split(/\s+/)[0] || "there";
  const v = (x: unknown, fallback = "-") => {
    const t = String(x ?? "").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, " ").trim();
    return t || fallback;
  };
  const order = v(p.orderNo);
  switch (template) {
    case "order_placed": return [name, order, v(p.total), v(p.trackUrl ?? p.orderUrl)];
    case "cod_confirmation": return [name, order, v(p.total)];
    case "shipped": return [name, order, v(p.awb, "will be shared soon"), v(p.trackUrl)];
    case "out_for_delivery":
    case "delivery_failed": return [name, order, v(p.trackUrl)];
    case "delivered": return [name, order, v(p.reviewUrl)];
    case "cancelled": return [name, order];
    case "payment_pending": return [name, order, v(p.total), v(p.payUrl)];
    case "abandoned_cart_1h":
    case "abandoned_cart_24h": return [name, v(p.recoveryUrl)];
    case "back_in_stock": return [v(p.productName, "Your item"), v(p.productUrl ?? p.shopUrl)];
    default: throw new Error(`No Meta template mapping for "${template}"`);
  }
}

const GRAPH = "https://graph.facebook.com/v23.0";

/** The outbox `payload` is a JSON column: some MySQL/MariaDB drivers return it parsed, others as text. */
const payloadOf = (row: RowDataPacket): Record<string, unknown> =>
  typeof row.payload === "string" ? JSON.parse(row.payload) : ((row.payload ?? {}) as Record<string, unknown>);

async function sendMeta(row: RowDataPacket) {
  const payload = payloadOf(row);
  const response = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: row.to_phone,
      type: "template",
      template: {
        name: row.template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [{ type: "body", parameters: metaParams(String(row.template), payload).map((text) => ({ type: "text", text })) }],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!response.ok) throw new Error(`Meta ${body.error?.code ?? response.status}: ${body.error?.message ?? "send failed"}`);
  return body.messages?.[0]?.id ?? null;
}

async function send(row: RowDataPacket) {
  if (isMeta()) return sendMeta(row);
  const response = await fetch(process.env.WHATSAPP_API_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: process.env.WHATSAPP_PROVIDER,
      to: row.to_phone,
      template: row.template,
      text: message(row.template, payloadOf(row)),
      payload: payloadOf(row),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) throw new Error(body.message || `WhatsApp HTTP ${response.status}`);
  return body.id ?? null;
}

export async function processWhatsAppOutbox(limit = 20) {
  const result = { sent: 0, failed: 0, waiting: 0 };
  // Updates are only useful while fresh: a cart nudge or "shipped" note a week late (e.g. queued before the
  // provider was connected) would confuse customers. Anything older than 24 h is closed, never sent.
  if (whatsappConfigured())
    await db().execute(
      "UPDATE whatsapp_outbox SET status='failed', error='Expired: older than 24 hours, not sent' WHERE status='pending' AND created_at < NOW() - INTERVAL 24 HOUR",
    );
  const [rows] = await db().query<Rows>(
    "SELECT * FROM whatsapp_outbox WHERE status = 'pending' AND next_attempt_at <= NOW() ORDER BY id LIMIT ?",
    [limit],
  );
  if (!rows.length) return result;
  if (!whatsappConfigured()) {
    result.waiting = rows.length;
    return result;
  }
  for (const row of rows) {
    const [claimed] = await db().execute<ResultSetHeader>(
      "UPDATE whatsapp_outbox SET status = 'sending' WHERE id = ? AND status = 'pending'",
      [row.id],
    );
    if (!claimed.affectedRows) continue;
    try {
      const providerId = await send(row);
      await db().execute("UPDATE whatsapp_outbox SET status='sent', provider_id=?, sent_at=NOW(), attempts=attempts+1, error=NULL WHERE id=?", [providerId, row.id]);
      result.sent++;
    } catch (error) {
      const attempts = Number(row.attempts) + 1;
      const failed = attempts >= BACKOFF.length;
      await db().execute(
        "UPDATE whatsapp_outbox SET status=?, attempts=?, error=?, next_attempt_at=NOW()+INTERVAL ? MINUTE WHERE id=?",
        [failed ? "failed" : "pending", attempts, String(error).slice(0, 255), BACKOFF[Math.min(attempts - 1, BACKOFF.length - 1)], row.id],
      );
      result.failed++;
    }
  }
  return result;
}

/** Delivery receipts from the Meta webhook: a message Meta could not deliver is marked failed with its reason. */
export async function markWhatsAppFailed(providerId: string, reason: string) {
  await db().execute("UPDATE whatsapp_outbox SET status='failed', error=? WHERE provider_id=?", [reason.slice(0, 255), providerId]);
}

export async function listWhatsAppMessages(limit = 100) {
  const [rows] = await db().query<Rows>(
    "SELECT id, template, to_phone, status, attempts, provider_id, error, created_at, sent_at FROM whatsapp_outbox ORDER BY id DESC LIMIT ?",
    [Math.min(Math.max(limit, 1), 200)],
  );
  return rows;
}

export async function listWhatsAppTemplates() {
  const [rows] = await db().query<Rows>("SELECT template, enabled, updated_at FROM whatsapp_templates ORDER BY template");
  return rows;
}

export async function setWhatsAppTemplate(template: string, enabledValue: boolean) {
  await db().execute("UPDATE whatsapp_templates SET enabled = ? WHERE template = ?", [enabledValue ? 1 : 0, template]);
}

export async function addWhatsAppOptout(phoneNumber: string) {
  await db().execute("INSERT IGNORE INTO whatsapp_optouts (phone) VALUES (?)", [phone(phoneNumber)]);
}
