import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ISSUES, type HelpTicket, type IssueKey } from "@/components/account/help/help-lib";
import { supportConfig } from "@/config/support";
import { site } from "@/data/site";
import { cloudinary, cloudinaryConfigured, destroyImage, isOwnCloudinaryUrl } from "./cloudinary";
import { db } from "./db";
import { kickOutbox } from "./mail";

/* Customer help requests (support_tickets) + FAQ feedback. Raw parameterised SQL only. */

const FOLDER = "swadeshi-mahadev/support";
export const ticketNoFor = (id: number) => `HLP-${1000 + id}`;

export type NewTicket = {
  customerId: number;
  orderId: number | null;
  issue: IssueKey;
  message: string;
  utr: string | null;
  contactPref: "whatsapp" | "call";
  callbackSlot: string | null;
  photos: { url: string; publicId: string }[];
};

export async function createSupportTicket(t: NewTicket): Promise<{ id: number; ticketNo: string }> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute<ResultSetHeader>(
      `INSERT INTO support_tickets (customer_id, order_id, issue, message, utr, contact_pref, callback_slot)
       VALUES (?,?,?,?,?,?,?)`,
      [t.customerId, t.orderId, t.issue, t.message, t.utr, t.contactPref, t.callbackSlot],
    );
    const id = r.insertId;
    const ticketNo = ticketNoFor(id);
    await conn.execute("UPDATE support_tickets SET ticket_no=? WHERE id=?", [ticketNo, id]);
    for (const p of t.photos)
      await conn.execute("INSERT INTO support_ticket_photos (ticket_id, url, public_id) VALUES (?,?,?)", [id, p.url, p.publicId]);
    await conn.commit();
    return { id, ticketNo };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** This customer's requests, newest first. */
export async function listSupportTickets(customerId: number, limit = 20): Promise<HelpTicket[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT t.id, t.ticket_no, t.order_id, o.order_no, t.issue, t.message, t.utr, t.contact_pref, t.callback_slot, t.status, t.created_at
       FROM support_tickets t LEFT JOIN orders o ON o.id=t.order_id
      WHERE t.customer_id=? ORDER BY t.id DESC LIMIT ?`,
    [customerId, limit],
  );
  if (!rows.length) return [];
  const [photos] = await db().query<RowDataPacket[]>(
    "SELECT ticket_id, url FROM support_ticket_photos WHERE ticket_id IN (?) ORDER BY id",
    [rows.map((r) => Number(r.id))],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    ticketNo: String(r.ticket_no ?? ticketNoFor(Number(r.id))),
    orderId: r.order_id == null ? null : Number(r.order_id),
    orderNo: r.order_no ? String(r.order_no) : null,
    issue: String(r.issue),
    message: String(r.message ?? ""),
    utr: r.utr ? String(r.utr) : null,
    contactPref: String(r.contact_pref) === "call" ? "call" : "whatsapp",
    callbackSlot: r.callback_slot ? String(r.callback_slot) : null,
    status: String(r.status),
    createdAt: String(r.created_at),
    photos: photos.filter((p) => Number(p.ticket_id) === Number(r.id)).map((p) => String(p.url)),
  }));
}

/* ── Photos: browser → Cloudinary (signed), then checked again on the server before saving ── */

export function signSupportUpload() {
  if (!cloudinaryConfigured()) return null;
  const params = {
    folder: FOLDER,
    timestamp: Math.round(Date.now() / 1000),
    allowed_formats: supportConfig.photos.formats.join(","),
  };
  return {
    ...params,
    signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!),
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  };
}

/**
 * Server-side type + size check of an uploaded help photo (Cloudinary Admin API).
 * Anything not ours, not an allowed format or over the size limit is deleted and rejected.
 */
export async function verifySupportPhoto(p: { url: string; publicId: string }): Promise<string | null> {
  if (!isOwnCloudinaryUrl(p.url, p.publicId) || !p.publicId.startsWith(`${FOLDER}/`))
    return "One of the photos was not uploaded to our image store.";
  try {
    const r = (await cloudinary.api.resource(p.publicId, { resource_type: "image" })) as { bytes: number; format: string };
    const formats: readonly string[] = supportConfig.photos.formats;
    if (!formats.includes(String(r.format).toLowerCase()) || Number(r.bytes) > supportConfig.photos.maxBytes) {
      await destroyImage(p.publicId);
      return "Photos must be JPG, PNG, WEBP or HEIC and under 5 MB.";
    }
    return null;
  } catch (e) {
    console.error("verifySupportPhoto", p.publicId, e);
    return "We couldn't check one of the photos. Remove it and try again.";
  }
}

/* ── Store alert via the email outbox (same table + worker as order emails) ── */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function queueSupportAlert(a: {
  ticketId: number;
  ticketNo: string;
  customer: { name: string; phone: string };
  orderId: number | null;
  orderNo: string | null;
  issue: IssueKey;
  message: string;
  utr: string | null;
  contactPref: "whatsapp" | "call";
  callbackSlot: string | null;
  photos: string[];
}) {
  const to = process.env.STORE_ALERT_EMAIL;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? site.url).replace(/\/$/, "");
  const rows: [string, string][] = [
    ["Ticket", a.ticketNo],
    ["Customer", `${a.customer.name || "—"} · ${a.customer.phone}`],
    ["Order", a.orderNo ? `#${a.orderNo}` : "Not about a specific order"],
    ["Issue", ISSUES[a.issue]],
    ["Message", a.message || "—"],
    ...(a.utr ? ([["UTR / UPI ref", a.utr]] as [string, string][]) : []),
    ["Contact", a.contactPref === "call" ? `Call back ${a.callbackSlot ?? ""}`.trim() : "WhatsApp"],
  ];
  const link = a.orderId ? `${base}/admin/orders/view?id=${a.orderId}` : `${base}/admin`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#17251d">
<h2 style="margin:0 0 12px">New help request ${esc(a.ticketNo)}</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#667;vertical-align:top">${esc(k)}</td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`)
    .join("")}</table>
${a.photos.map((u) => `<p><a href="${esc(u)}">${esc(u)}</a></p>`).join("")}
<p><a href="${esc(link)}">Open in admin</a></p></div>`;
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n${a.photos.join("\n")}\n${link}`;
  try {
    await db().execute(
      `INSERT IGNORE INTO email_outbox (order_id, template, to_email, subject, html, text_body, dedupe_key)
       VALUES (?, 'store_support_ticket', ?, ?, ?, ?, ?)`,
      [
        a.orderId,
        to,
        `Help request ${a.ticketNo} – ${ISSUES[a.issue]}${a.orderNo ? ` · #${a.orderNo}` : ""}`.slice(0, 200),
        html,
        text,
        `store_support_ticket:${a.ticketId}:${to}`.slice(0, 120),
      ],
    );
    kickOutbox();
  } catch (e) {
    console.error("Support alert email could not be queued", e);
  }
}

/* ── FAQ 👍 / 👎 ── */

export async function recordFaqFeedback(faqId: string, helpful: boolean) {
  await db().execute(
    `INSERT INTO faq_feedback (faq_id, helpful, not_helpful) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE helpful = helpful + VALUES(helpful), not_helpful = not_helpful + VALUES(not_helpful)`,
    [faqId, helpful ? 1 : 0, helpful ? 0 : 1],
  );
}
