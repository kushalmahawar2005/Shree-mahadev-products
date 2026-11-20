import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ISSUES, type IssueKey, type TicketMessage } from "@/components/account/help/help-lib";
import { ticketMessages } from "./support-tickets";
import { db } from "./db";
import { queueBackInStock } from "./whatsapp";

/* Admin help desk: returns, support tickets, back-in-stock waitlist, FAQ feedback. Raw parameterised SQL only. */

type Rows = RowDataPacket[];

// ───────────── Returns ─────────────

export const RETURN_STATUSES = ["requested", "approved", "rejected", "received", "refunded"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Which next steps are allowed from each status. */
export const RETURN_NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["refunded"],
  rejected: [],
  refunded: [],
};

export type AdminReturn = {
  id: number;
  orderId: number;
  orderNo: string;
  orderTotal: number;
  paymentMethod: string;
  customerName: string;
  phone: string;
  email: string;
  reason: string;
  note: string | null;
  status: ReturnStatus;
  createdAt: string;
  updatedAt: string;
  items: { variantKey: string; qty: number; title: string; variant: string; unitPrice: number; image: string | null }[];
};

export async function listReturns(): Promise<AdminReturn[]> {
  const [rows] = await db().query<Rows>(
    `SELECT r.id, r.order_id, r.items, r.reason, r.note, r.status, r.created_at, r.updated_at,
            o.order_no, o.total, o.payment_method, o.customer_name, o.phone, o.email
       FROM order_returns r JOIN orders o ON o.id = r.order_id
      ORDER BY FIELD(r.status, 'requested', 'approved', 'received', 'refunded', 'rejected'), r.created_at DESC
      LIMIT 300`,
  );
  if (!rows.length) return [];
  const orderIds = rows.map((r) => r.order_id as number);
  const [lines] = await db().query<Rows>(
    `SELECT oi.order_id, oi.variant_key, oi.product_title, oi.variant_title, oi.unit_price,
            (SELECT i.url FROM product_images i WHERE i.product_handle = oi.product_handle ORDER BY i.sort_order, i.id LIMIT 1) AS image
       FROM order_items oi WHERE oi.order_id IN (?)`,
    [orderIds],
  );
  const byOrder = new Map<string, RowDataPacket>();
  for (const l of lines) byOrder.set(`${l.order_id}:${l.variant_key}`, l);

  return rows.map((r) => {
    const raw = (typeof r.items === "string" ? JSON.parse(r.items) : r.items) as { variantKey: string; qty: number }[];
    return {
      id: r.id,
      orderId: r.order_id,
      orderNo: r.order_no ?? `#${r.order_id}`,
      orderTotal: r.total,
      paymentMethod: r.payment_method,
      customerName: r.customer_name,
      phone: r.phone,
      email: r.email,
      reason: r.reason,
      note: r.note,
      status: r.status as ReturnStatus,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      items: (raw ?? []).map((i) => {
        const l = byOrder.get(`${r.order_id}:${i.variantKey}`);
        return {
          variantKey: i.variantKey,
          qty: i.qty,
          title: l?.product_title ?? i.variantKey,
          variant: l?.variant_title ?? "",
          unitPrice: l?.unit_price ?? 0,
          image: l?.image ?? null,
        };
      }),
    };
  });
}

/** Move a return to its next status and log it on the order timeline. */
export async function setReturnStatus(id: number, next: ReturnStatus, actor: string, note?: string) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query<Rows>("SELECT order_id, status FROM order_returns WHERE id = ? FOR UPDATE", [id]);
    if (!row) throw new Error("Return not found");
    const from = row.status as ReturnStatus;
    if (!RETURN_NEXT[from]?.includes(next)) throw new Error(`A ${from} return can't be marked ${next}`);
    await conn.execute("UPDATE order_returns SET status = ? WHERE id = ?", [next, id]);
    await conn.execute(
      "INSERT INTO order_events (order_id, from_status, to_status, actor, note) VALUES (?, ?, ?, ?, ?)",
      [row.order_id, `return_${from}`.slice(0, 20), `return_${next}`.slice(0, 20), "admin", [`Return ${next} by ${actor}`, note].filter(Boolean).join(": ").slice(0, 500)],
    );
    await conn.commit();
    return row.order_id as number;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Open return (if any) for an order: used for the badge on the order page. */
export async function returnForOrder(orderId: number): Promise<{ id: number; status: ReturnStatus } | null> {
  const [[r]] = await db().query<Rows>("SELECT id, status FROM order_returns WHERE order_id = ?", [orderId]);
  return r ? { id: r.id, status: r.status } : null;
}

// ───────────── Support tickets ─────────────

export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type AdminTicket = {
  id: number;
  ticketNo: string;
  issue: string;
  issueLabel: string;
  message: string;
  utr: string | null;
  contactPref: string;
  callbackSlot: string | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  phone: string;
  email: string | null;
  orderId: number | null;
  orderNo: string | null;
  orderStatus: string | null;
  photos: string[];
  messages: TicketMessage[];
};

export async function listTickets(): Promise<AdminTicket[]> {
  const [rows] = await db().query<Rows>(
    `SELECT t.*, c.name, c.phone, c.email, o.order_no, o.status AS order_status
       FROM support_tickets t
       JOIN customers c ON c.id = t.customer_id
       LEFT JOIN orders o ON o.id = t.order_id
      ORDER BY FIELD(t.status, 'open', 'in_progress', 'resolved'), t.created_at DESC
      LIMIT 300`,
  );
  if (!rows.length) return [];
  const [photos] = await db().query<Rows>("SELECT ticket_id, url FROM support_ticket_photos WHERE ticket_id IN (?) ORDER BY id", [rows.map((r) => r.id)]);
  const pics = new Map<number, string[]>();
  for (const p of photos) pics.set(p.ticket_id, [...(pics.get(p.ticket_id) ?? []), p.url]);
  const messages = await ticketMessages(rows.map((r) => Number(r.id)));
  return rows.map((r) => ({
    id: r.id,
    ticketNo: r.ticket_no ?? `HLP-${1000 + r.id}`,
    issue: r.issue,
    issueLabel: ISSUES[r.issue as IssueKey] ?? r.issue,
    message: r.message,
    utr: r.utr,
    contactPref: r.contact_pref,
    callbackSlot: r.callback_slot,
    status: r.status as TicketStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    customerName: r.name,
    phone: r.phone,
    email: r.email,
    orderId: r.order_id,
    orderNo: r.order_no,
    orderStatus: r.order_status,
    photos: pics.get(r.id) ?? [],
    messages: messages.get(Number(r.id)) ?? [],
  }));
}

export async function setTicketStatus(id: number, status: TicketStatus) {
  const [res] = await db().execute<ResultSetHeader>("UPDATE support_tickets SET status = ? WHERE id = ?", [status, id]);
  if (!res.affectedRows) throw new Error("Ticket not found");
}

/** Counts for the sidebar badge: returns waiting + tickets not resolved. */
export async function helpdeskOpenCount(): Promise<number> {
  const [[r]] = await db().query<Rows>(
    `SELECT (SELECT COUNT(*) FROM order_returns WHERE status IN ('requested','approved','received'))
          + (SELECT COUNT(*) FROM support_tickets WHERE status <> 'resolved') AS n`,
  );
  return Number(r?.n ?? 0);
}

// ───────────── Back-in-stock waitlist ─────────────

export type WaitlistGroup = {
  variantKey: string;
  productTitle: string;
  variant: string;
  handle: string | null;
  image: string | null;
  stock: number | null;
  available: boolean;
  waiting: number;
  notified: number;
  oldest: string;
  phones: { phone: string; at: string }[];
};

export async function listWaitlist(): Promise<WaitlistGroup[]> {
  const [rows] = await db().query<Rows>(
    `SELECT b.variant_key, b.phone, b.created_at, b.notified_at,
            v.title AS variant, v.stock_qty, v.available, p.handle, p.title AS product_title,
            (SELECT i.url FROM product_images i WHERE i.product_handle = p.handle ORDER BY i.sort_order, i.id LIMIT 1) AS image
       FROM back_in_stock b
       LEFT JOIN product_variants v ON v.variant_key = b.variant_key
       LEFT JOIN products p ON p.id = v.product_id
      ORDER BY b.created_at`,
  );
  const groups = new Map<string, WaitlistGroup>();
  for (const r of rows) {
    let g = groups.get(r.variant_key);
    if (!g) {
      g = {
        variantKey: r.variant_key,
        productTitle: r.product_title ?? r.variant_key,
        variant: r.variant ?? "",
        handle: r.handle ?? null,
        image: r.image ?? null,
        stock: r.stock_qty ?? null,
        available: Boolean(r.available),
        waiting: 0,
        notified: 0,
        oldest: String(r.created_at),
        phones: [],
      };
      groups.set(r.variant_key, g);
    }
    if (r.notified_at) g.notified++;
    else {
      g.waiting++;
      g.phones.push({ phone: r.phone, at: String(r.created_at) });
    }
  }
  return [...groups.values()].filter((g) => g.waiting > 0 || g.notified > 0).sort((a, b) => b.waiting - a.waiting);
}

/** Queue the WhatsApp "back in stock" message to everyone still waiting on a variant. */
export async function notifyWaitlist(variantKey: string): Promise<number> {
  const [rows] = await db().query<Rows>("SELECT id, phone FROM back_in_stock WHERE variant_key = ? AND notified_at IS NULL", [variantKey]);
  let n = 0;
  for (const r of rows) {
    if (!(await queueBackInStock(r.phone, variantKey))) continue;
    await db().execute("UPDATE back_in_stock SET notified_at = NOW() WHERE id = ?", [r.id]);
    n++;
  }
  if (rows.length && !n) throw new Error("No message was queued. Check that the WhatsApp “back in stock” template is on (Messages page).");
  return n;
}

// ───────────── FAQ feedback ─────────────

export async function listFaqFeedback(): Promise<{ faqId: string; helpful: number; notHelpful: number; updatedAt: string }[]> {
  const [rows] = await db().query<Rows>("SELECT faq_id, helpful, not_helpful, updated_at FROM faq_feedback ORDER BY (helpful + not_helpful) DESC");
  return rows.map((r) => ({ faqId: r.faq_id, helpful: r.helpful, notHelpful: r.not_helpful, updatedAt: String(r.updated_at) }));
}
