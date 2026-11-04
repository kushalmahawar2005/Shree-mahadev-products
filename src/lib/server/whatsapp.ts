import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";

type Rows = RowDataPacket[];
const BACKOFF = [1, 5, 15, 60, 240];
const phone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits.replace(/^00/, "");
};

export const whatsappConfigured = () =>
  Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_API_URL);

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

export async function queueOrderWhatsApp(orderId: number, template: "order_placed" | "cod_confirmation" | "shipped" | "delivered" | "cancelled") {
  const [[order]] = await db().query<Rows>(
    `SELECT id, order_no, token, customer_name, phone, total, payment_method, status, awb, tracking_url
     FROM orders WHERE id = ?`,
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
  }, { orderId, dedupe: `${template}:${orderId}` });
}

export async function queueCartWhatsApp(cartId: number, template: "abandoned_cart_1h" | "abandoned_cart_24h") {
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
  if (sent) await db().execute("UPDATE carts SET reminder_count = reminder_count + 1, reminder_sent_at = NOW() WHERE id = ?", [cartId]);
  return sent;
}

export async function queueBackInStock(phoneNumber: string, variantKey: string) {
  return queue("back_in_stock", phoneNumber, {
    variantKey,
    shopUrl: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/shop`,
  }, { dedupe: `back_in_stock:${variantKey}:${phone(phoneNumber)}` });
}

function message(template: string, payload: Record<string, unknown>) {
  const name = String(payload.name ?? "there");
  const order = payload.orderNo ? ` for order ${payload.orderNo}` : "";
  const common = `Namaste ${name}, this is Swadeshi Mahadev Products.`;
  switch (template) {
    case "cod_confirmation": return `${common} Please reply YES to confirm your COD order${order}, or NO to cancel.`;
    case "shipped": return `${common} Your order${order} has shipped. AWB: ${payload.awb ?? "available in your tracking page"}.`;
    case "delivered": return `${common} Your order${order} was delivered. We would love your feedback: ${payload.reviewUrl}`;
    case "cancelled": return `${common} Your order${order} has been cancelled.`;
    case "abandoned_cart_1h":
    case "abandoned_cart_24h": return `${common} You left items in your cart. Complete your order here: ${payload.recoveryUrl}\n${payload.optOut}`;
    case "back_in_stock": return `${common} An item you wanted is back in stock: ${payload.shopUrl}\n${payload.optOut}`;
    default: return `${common} We received your order${order}. Total: ₹${payload.total}. Track it here: ${payload.orderUrl}`;
  }
}

async function send(row: RowDataPacket) {
  const response = await fetch(process.env.WHATSAPP_API_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: process.env.WHATSAPP_PROVIDER,
      to: row.to_phone,
      template: row.template,
      text: message(row.template, JSON.parse(String(row.payload))),
      payload: JSON.parse(String(row.payload)),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) throw new Error(body.message || `WhatsApp HTTP ${response.status}`);
  return body.id ?? null;
}

export async function processWhatsAppOutbox(limit = 20) {
  const result = { sent: 0, failed: 0, waiting: 0 };
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
