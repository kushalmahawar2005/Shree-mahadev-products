import "server-only";
import { render } from "@react-email/render";
import { after } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { site, whatsappLink } from "@/data/site";
import {
  OrderEmail,
  subjectFor,
  type EmailBrand,
  type EmailKind,
  type EmailOrder,
} from "@/emails/OrderEmail";
import { InquiryEmail, type InquiryEmailData } from "@/emails/InquiryEmail";
import { db } from "./db";

/**
 * Transactional email via Resend, through the email_outbox table:
 * queue (rendered + stored) → send with retries. Never throws into checkout or webhooks.
 */

type Rows = RowDataPacket[];
const RESEND_URL = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 15, 60, 240];

const siteUrl = () =>
  (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://swadeshimahadevproducts.com"
  ).replace(/\/$/, "");
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY);
const mailFrom = () =>
  process.env.MAIL_FROM ||
  "Swadeshi Mahadev <orders@swadeshimahadevproducts.com>";

function resendUrl() {
  const override = process.env.RESEND_API_URL;
  if (!override || process.env.NODE_ENV === "production") return RESEND_URL;
  const url = new URL(override);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("RESEND_API_URL is only allowed to point to a local HTTP mock outside production");
  }
  return url.toString();
}

function brand(): EmailBrand {
  return {
    siteUrl: siteUrl(),
    logoUrl:
      "https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png",
    phone: site.phone,
    whatsappUrl: whatsappLink(),
    supportHours: site.supportHours,
    email: site.email,
    address: `${site.address.city}, ${site.address.state}`,
    fssai: site.fssai,
  };
}

async function loadEmailOrder(
  orderId: number,
): Promise<(EmailOrder & { id: number; token: string }) | null> {
  const [[o]] = await db().query<Rows>(
    `SELECT o.*, s.awb, s.courier, s.tracking_url FROM orders o
     LEFT JOIN shipments s ON s.id = (SELECT MAX(id) FROM shipments WHERE order_id = o.id AND status <> 'cancelled')
     WHERE o.id = ?`,
    [orderId],
  );
  if (!o) return null;
  const [items] = await db().query<Rows>(
    "SELECT product_title, variant_title, quantity, line_total FROM order_items WHERE order_id = ?",
    [orderId],
  );
  return {
    id: o.id,
    token: o.token,
    orderNo: o.order_no,
    name: o.customer_name,
    phone: o.phone,
    email: o.email,
    address: [
      o.address_line1,
      o.address_line2,
      `${o.city}, ${o.state} ${o.pincode}`,
    ]
      .filter(Boolean)
      .join(", "),
    paymentMethod: o.payment_method,
    items: items.map((i) => ({
      title: i.product_title,
      size: i.variant_title,
      qty: i.quantity,
      lineTotal: i.line_total,
    })),
    subtotal: o.subtotal,
    discount: o.discount,
    couponCode: o.coupon_code,
    shipping: o.shipping,
    codFee: o.cod_fee,
    total: o.total,
    orderUrl: `${siteUrl()}/order?t=${o.token}`,
    reviewUrl: `${siteUrl()}/review?t=${o.token}`,
    invoiceUrl: `${siteUrl()}/order/invoice?t=${o.token}`,
    trackingPageUrl: `${siteUrl()}/track-order?t=${o.token}`,
    courier: o.courier,
    awb: o.awb,
    trackingUrl: o.tracking_url,
  };
}

/** Render one email and store it in the outbox. Same event is queued only once unless `resend`. */
export async function queueOrderEmail(
  orderId: number,
  kind: EmailKind,
  opts: { resend?: boolean; refundAmount?: number; note?: string } = {},
) {
  const order = await loadEmailOrder(orderId);
  if (!order) return null;
  const isStore = kind === "store_new_order";
  const to = isStore ? process.env.STORE_ALERT_EMAIL : order.email;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null; // email is optional for customers
  const data: EmailOrder = {
    ...order,
    refundAmount: opts.refundAmount,
    note: opts.note ?? null,
  };
  const ctaUrl = isStore
    ? `${siteUrl()}/admin/orders/view?id=${order.id}`
    : kind === "delivered"
      ? order.reviewUrl
      : kind === "shipped"
        ? order.trackingPageUrl
        : order.orderUrl;
  const element = OrderEmail({ kind, order: data, brand: brand(), ctaUrl });
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  const [r] = await db().execute<ResultSetHeader>(
    `INSERT IGNORE INTO email_outbox (order_id, template, to_email, subject, html, text_body, dedupe_key) VALUES (?,?,?,?,?,?,?)`,
    [
      orderId,
      kind,
      to,
      subjectFor(kind, data),
      html,
      text,
      opts.resend ? null : `${kind}:${orderId}:${to}`,
    ],
  );
  return r.affectedRows ? r.insertId : null;
}

async function sendOne(row: RowDataPacket) {
  const res = await fetch(resendUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Resend de-duplicates retries of the same message.
      "Idempotency-Key": `smp-outbox-${row.id}`,
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [row.to_email],
      subject: row.subject,
      html: row.html,
      text: row.text_body,
      reply_to: site.email,
      tags: [{ name: "template", value: row.template }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };
  if (!res.ok || !json.id)
    throw new Error(json.message || json.name || `Resend HTTP ${res.status}`);
  return json.id;
}

/** Send due messages. Safe to call often; each row is claimed atomically. */
export async function processOutbox(
  limit = 20,
): Promise<{ sent: number; failed: number; waiting: number }> {
  const out = { sent: 0, failed: 0, waiting: 0 };
  const [due] = await db().query<Rows>(
    "SELECT id FROM email_outbox WHERE status = 'pending' AND next_attempt_at <= NOW() ORDER BY id LIMIT ?",
    [limit],
  );
  if (!due.length) return out;
  if (!mailConfigured()) {
    await db().query(
      "UPDATE email_outbox SET error = 'RESEND_API_KEY not set: waiting' WHERE id IN (?) AND status = 'pending'",
      [due.map((d) => d.id)],
    );
    out.waiting = due.length;
    return out;
  }
  for (const { id } of due) {
    const [claim] = await db().execute<ResultSetHeader>(
      "UPDATE email_outbox SET status = 'sending' WHERE id = ? AND status = 'pending'",
      [id],
    );
    if (!claim.affectedRows) continue;
    const [[row]] = await db().query<Rows>(
      "SELECT * FROM email_outbox WHERE id = ?",
      [id],
    );
    try {
      const providerId = await sendOne(row);
      await db().execute(
        "UPDATE email_outbox SET status = 'sent', provider_id = ?, sent_at = NOW(), error = NULL, attempts = attempts + 1 WHERE id = ?",
        [providerId, id],
      );
      out.sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const final = attempts >= MAX_ATTEMPTS;
      await db().execute(
        `UPDATE email_outbox SET status = ?, attempts = ?, error = ?, next_attempt_at = NOW() + INTERVAL ? MINUTE WHERE id = ?`,
        [
          final ? "failed" : "pending",
          attempts,
          String((e as Error).message).slice(0, 255),
          BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)],
          id,
        ],
      );
      out.failed++;
    }
  }
  return out;
}

/** Run the outbox after the response is sent (falls back to fire-and-forget outside a request). */
export function kickOutbox() {
  const run = () =>
    processOutbox().catch((e) => console.error("processOutbox", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Order lifecycle notifications. Call AFTER the database change is committed.
 * New orders/payments also alert the store.
 */
export async function notifyOrder(
  orderId: number,
  kind: Exclude<EmailKind, "store_new_order">,
  opts: { refundAmount?: number } = {},
) {
  try {
    await queueOrderEmail(orderId, kind, opts);
    if (kind === "order_placed" || kind === "payment_received")
      await queueOrderEmail(orderId, "store_new_order");
    kickOutbox();
  } catch (e) {
    console.error("notifyOrder", orderId, kind, e);
  }
}

/** Queue a store alert for a bulk inquiry; the email worker handles delivery and retries. */
export async function queueInquiryAlert(
  inquiryId: number,
  input: Omit<InquiryEmailData, "id" | "adminUrl">,
) {
  const to = process.env.STORE_ALERT_EMAIL;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
  try {
    const data: InquiryEmailData = {
      ...input,
      id: inquiryId,
      adminUrl: `${siteUrl()}/admin/inquiries`,
    };
    const element = InquiryEmail({ inquiry: data });
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);
    await db().execute(
      `INSERT IGNORE INTO email_outbox (order_id, template, to_email, subject, html, text_body, dedupe_key)
       VALUES (NULL, 'store_new_inquiry', ?, ?, ?, ?, ?)`,
      [
        to,
        `New bulk inquiry – ${data.business || data.name}`,
        html,
        text,
        `store_new_inquiry:${inquiryId}:${to}`,
      ],
    );
    kickOutbox();
  } catch (error) {
    console.error("Inquiry alert email could not be queued", error);
  }
}

export type OutboxRow = {
  id: number;
  template: string;
  to: string;
  subject: string;
  status: string;
  attempts: number;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
};

export async function listOrderEmails(orderId: number): Promise<OutboxRow[]> {
  const [rows] = await db().query<Rows>(
    "SELECT id, template, to_email, subject, status, attempts, error, sent_at, created_at FROM email_outbox WHERE order_id = ? ORDER BY id DESC",
    [orderId],
  );
  return rows.map((r) => ({
    id: r.id,
    template: r.template,
    to: r.to_email,
    subject: r.subject,
    status: r.status,
    attempts: r.attempts,
    error: r.error,
    sentAt: r.sent_at,
    createdAt: r.created_at,
  }));
}

export async function getOutboxHtml(id: number): Promise<string | null> {
  const [[r]] = await db().query<Rows>(
    "SELECT html FROM email_outbox WHERE id = ?",
    [id],
  );
  return (r?.html as string) ?? null;
}
