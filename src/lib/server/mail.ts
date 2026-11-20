import "server-only";
import { createHash } from "node:crypto";
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
import { CartEmail } from "@/emails/CartEmail";
import { OtpEmail } from "@/emails/OtpEmail";
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
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://swadeshimahadevproducts.in"
  ).replace(/\/$/, "");
const DEFAULT_FROM = "Swadeshi Mahadev <orders@swadeshimahadevproducts.in>";

/** SMTP backup (Nodemailer): used only when Resend fails. Needs SMTP_HOST, SMTP_USER, SMTP_PASS. */
const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY) || smtpConfigured();

/**
 * Sender address. Resend's shared test sender (…@resend.dev) only delivers to the Resend account
 * owner, so in production it is swapped for our verified domain; otherwise customers get nothing.
 */
const mailFrom = () => {
  const from = process.env.MAIL_FROM || DEFAULT_FROM;
  return process.env.NODE_ENV === "production" && /@resend\.dev>?\s*$/i.test(from) ? DEFAULT_FROM : from;
};

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

/** One photo per line: that size's front shot when there is one, else the product's first photo. */
async function photoLookup(handlesIn: string[]) {
  const handles = [...new Set(handlesIn)];
  const [imgs] = handles.length
    ? await db().query<Rows>(
        `SELECT product_handle, url FROM product_images WHERE product_handle IN (${handles.map(() => "?").join(",")}) ORDER BY sort_order, id`,
        handles,
      )
    : [[] as Rows];
  return (handle: string, size: string) => {
    const own = imgs.filter((im) => im.product_handle === handle).map((im) => String(im.url));
    const slug = size.toLowerCase().replace(/\s+/g, "");
    const url = own.find((u) => u.includes(`/${slug}-front.`)) ?? own[0];
    // Email-safe: JPEG, small, padded on the brand cream (no WebP/AVIF for Outlook).
    return url?.includes("/image/upload/") ? url.replace("/image/upload/", "/image/upload/f_jpg,q_auto,c_pad,w_112,h_140,b_rgb:FBF5E5/") : undefined;
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
    "SELECT product_handle, product_title, variant_title, quantity, line_total FROM order_items WHERE order_id = ?",
    [orderId],
  );
  const photoFor = await photoLookup(items.map((i) => String(i.product_handle)));
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
      image: photoFor(String(i.product_handle), String(i.variant_title)),
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
    payUrl: `${siteUrl()}/checkout/pay?t=${o.token}`,
    courier: o.courier,
    awb: o.awb,
    trackingUrl: o.tracking_url,
  };
}

/**
 * Abandoned-cart reminder email (stage 1 ≈ 1 h, stage 2 ≈ 24 h). Only carts that left an email at
 * checkout. Queued once per cart and stage; returns true when queued.
 */
export async function queueCartEmail(cartId: number, stage: 1 | 2) {
  const [[cart]] = await db().query<Rows>(
    "SELECT id, token, name, email, subtotal FROM carts WHERE id = ? AND status = 'active'",
    [cartId],
  );
  const to = cart?.email ? String(cart.email) : "";
  if (!cart || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  const [items] = await db().query<Rows>(
    "SELECT product_handle, product_title, variant_title, unit_price, quantity FROM cart_items WHERE cart_id = ?",
    [cartId],
  );
  if (!items.length) return false;
  const photoFor = await photoLookup(items.map((i) => String(i.product_handle)));
  const data = {
    name: String(cart.name ?? "").split(" ")[0] || "there",
    stage,
    recoveryUrl: `${siteUrl()}/cart/recover/${cart.token}`,
    subtotal: items.reduce((n, i) => n + Number(i.unit_price) * Number(i.quantity), 0),
    items: items.map((i) => ({
      title: String(i.product_title),
      size: String(i.variant_title),
      qty: Number(i.quantity),
      lineTotal: Number(i.unit_price) * Number(i.quantity),
      image: photoFor(String(i.product_handle), String(i.variant_title)),
    })),
  };
  const element = CartEmail({ cart: data, brand: brand() });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const [r] = await db().execute<ResultSetHeader>(
    `INSERT IGNORE INTO email_outbox (order_id, template, to_email, subject, html, text_body, dedupe_key) VALUES (NULL,?,?,?,?,?,?)`,
    [
      stage === 1 ? "cart_reminder_1" : "cart_reminder_2",
      to,
      stage === 1 ? "You left something in your cart" : "Your cart is still waiting – Swadeshi Mahadev",
      html,
      text,
      `cart_reminder_${stage}:${cartId}`,
    ],
  );
  return r.affectedRows > 0;
}

/** Render one email and store it in the outbox. Same event is queued only once unless `resend`. */
export async function queueOrderEmail(
  orderId: number,
  kind: EmailKind,
  opts: { resend?: boolean; refundAmount?: number; note?: string; dedupeSuffix?: string } = {},
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
      : kind === "shipped" || kind === "out_for_delivery"
        ? order.trackingPageUrl
        : kind === "payment_pending"
          ? order.payUrl
          : kind === "delivery_failed"
            ? whatsappLink(`Hi, about order ${order.orderNo}: the courier couldn't deliver it. `)
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
      opts.resend ? null : `${kind}:${orderId}:${to}${opts.dedupeSuffix ? `:${opts.dedupeSuffix}` : ""}`,
    ],
  );
  return r.affectedRows ? r.insertId : null;
}

/** One email to send. `key` makes Resend de-duplicate retries of the same message. */
type Message = { key: string; to: string; subject: string; html: string; text?: string | null; template: string };

const messageOf = (row: RowDataPacket): Message => ({
  key: `smp-outbox-${row.id}`,
  to: String(row.to_email),
  subject: String(row.subject),
  html: String(row.html),
  text: row.text_body ? String(row.text_body) : null,
  template: String(row.template),
});

async function sendViaResend(m: Message) {
  const res = await fetch(resendUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Resend de-duplicates retries of the same message.
      "Idempotency-Key": m.key,
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text ?? undefined,
      reply_to: site.email,
      tags: [{ name: "template", value: m.template }],
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

/** Backup path: the same message through any SMTP mailbox (Hostinger mail, Gmail app password…). */
async function sendViaSmtp(m: Message) {
  const { createTransport } = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15_000,
  });
  const info = await transport.sendMail({
    // The mailbox must be allowed to send as this address (usually SMTP_USER itself).
    from: process.env.SMTP_FROM || mailFrom(),
    to: m.to,
    subject: m.subject,
    html: m.html,
    text: m.text ?? undefined,
    replyTo: site.email,
    headers: { "X-Message-Key": m.key },
  });
  return `smtp:${info.messageId}`;
}

/** Resend first; if it fails (outage, quota, bad key) and SMTP is set up, Nodemailer sends it instead. */
async function sendMessage(m: Message) {
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendViaResend(m);
    } catch (error) {
      if (!smtpConfigured()) throw error;
      console.error("resend failed, trying SMTP", error instanceof Error ? error.message : error);
    }
  }
  return sendViaSmtp(m);
}

const sendOne = (row: RowDataPacket) => sendMessage(messageOf(row));

/**
 * Login code by email. Sent straight away, NOT through the outbox: the code must never be stored
 * (the outbox keeps the HTML for admins) and a code that arrives minutes later is useless anyway.
 * Returns false on any failure so the caller can show a message.
 */
export async function sendLoginCodeEmail(to: string, code: string, minutes: number) {
  if (!mailConfigured()) return false;
  try {
    const element = OtpEmail({ code, minutes, logoUrl: brand().logoUrl, siteName: site.name });
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
    await sendMessage({
      key: `smp-login-${createHash("sha256").update(`${to}:${code}:${Date.now()}`).digest("hex").slice(0, 32)}`,
      to,
      subject: `${code} is your ${site.name} login code`,
      html,
      text,
      template: "login_otp",
    });
    return true;
  } catch (error) {
    console.error("login code email failed", error instanceof Error ? error.message : error);
    return false;
  }
}

/** Refund approval code to the owner's inbox. Sent directly (never stored in the outbox). */
export async function sendRefundOtpEmail(
  to: string,
  code: string,
  d: { orderNo: string; amount: number; by: string; minutes: number },
) {
  if (!mailConfigured()) return false;
  try {
    const amount = `₹${d.amount.toLocaleString("en-IN")}`;
    const element = OtpEmail({
      code,
      minutes: d.minutes,
      logoUrl: brand().logoUrl,
      siteName: site.name,
      title: `Approve refund of ${amount}`,
      intro: `Admin "${d.by}" wants to refund ${amount} on order ${d.orderNo}. Share this code only if you approve.`,
      preview: `${code}: refund ${amount} on ${d.orderNo}`,
    });
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
    await sendMessage({
      key: `smp-refund-otp-${createHash("sha256").update(`${to}:${code}:${Date.now()}`).digest("hex").slice(0, 32)}`,
      to,
      subject: `${code} · Refund approval for ${d.orderNo} (${amount})`,
      html,
      text,
      template: "refund_otp",
    });
    return true;
  } catch (error) {
    console.error("refund code email failed", error instanceof Error ? error.message : error);
    return false;
  }
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
