import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { cache } from "react";
import { accountConfig } from "@/config/account";
import { getCustomerSession } from "./customer-auth";
import { db } from "./db";

/** Orders that really happened (unpaid, failed, abandoned and cancelled ones don't count). */
export const PLACED_STATUSES = [
  "paid",
  "cod_pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "refunded",
  "partially_refunded",
] as const;
/** Still on their way (or waiting for payment). */
export const ACTIVE_STATUSES = [
  "pending_payment",
  "paid",
  "cod_pending",
  "confirmed",
  "packed",
  "shipped",
] as const;
const ONLINE_PAID = ["paid", "confirmed", "packed", "shipped", "delivered"];

export type AccountShellData = {
  customer: { id: number; name: string; phone: string; email: string };
  stats: { orders: number; spent: number; saved: number };
  activeOrders: number;
};

/**
 * Profile + stats for the account shell, computed on the server from this session only.
 * - Orders: every order in the account (same as the "All" tab, cancelled included).
 * - Spent: paid online orders + delivered COD orders.
 * - Saved: (MRP total − amount paid) over those same orders, never below 0 per order.
 */
export const getAccountShell = cache(
  async (): Promise<AccountShellData | null> => {
    const session = await getCustomerSession();
    if (!session) return null;
    const id = session.id;
    const [[counts], [money]] = await Promise.all([
      db().query<RowDataPacket[]>(
        `SELECT COUNT(*) AS placed,
              SUM(status IN (?) AND NOT (status='pending_payment' AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR))) AS active
         FROM orders WHERE customer_id=?`,
        [
          ACTIVE_STATUSES,
          accountConfig.pendingOrderExpiryHours,
          id,
        ],
      ),
      db().query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(o.total),0) AS spent,
              COALESCE(SUM(GREATEST(m.mrp - o.total, 0)),0) AS saved
         FROM orders o
         JOIN (SELECT order_id, SUM(GREATEST(COALESCE(compare_at_price, unit_price), unit_price) * quantity) AS mrp
                 FROM order_items GROUP BY order_id) m ON m.order_id = o.id
        WHERE o.customer_id=?
          AND ((o.payment_method='payu' AND o.status IN (?)) OR (o.payment_method='cod' AND o.status='delivered'))`,
        [id, ONLINE_PAID],
      ),
    ]);
    return {
      customer: session,
      stats: {
        orders: Number(counts[0]?.placed ?? 0),
        spent: Number(money[0]?.spent ?? 0),
        saved: Number(money[0]?.saved ?? 0),
      },
      activeOrders: Number(counts[0]?.active ?? 0),
    };
  },
);

/* ───────────────────────── Orders for the account pages ───────────────────────── */

export type AccountOrderItem = {
  handle: string;
  title: string;
  variant: string;
  qty: number;
  price: number;
  mrp: number;
  variantKey: string;
};
export type AccountOrder = {
  id: number;
  orderNo: string;
  token: string;
  status: string;
  method: string;
  total: number;
  createdAt: string;
  /** Unpaid online order: when it auto-cancels (IST string), else null. */
  expiresAt: string | null;
  /** Hours left before an unpaid order auto-cancels (≤0 = expired), else null. */
  expiresInHours: number | null;
  items: AccountOrderItem[];
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
  eta: string | null;
  /** First time the order reached each timeline step (index → "12 Nov, 5:40 PM"-able IST string). */
  stepTimes: Partial<Record<number, string>>;
  reviewed: boolean;
};

const STEP_OF: Record<string, number> = {
  pending_payment: 0,
  paid: 0,
  cod_pending: 0,
  confirmed: 0,
  packed: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
};

const ORDER_COLUMNS = `o.id, o.order_no, o.token, o.status, o.payment_method, o.total, o.created_at,
            IF(o.status='pending_payment', DATE_ADD(o.created_at, INTERVAL ${Number(accountConfig.pendingOrderExpiryHours)} HOUR), NULL) AS expires_at,
            IF(o.status='pending_payment', CEIL(TIMESTAMPDIFF(MINUTE, NOW(), DATE_ADD(o.created_at, INTERVAL ${Number(accountConfig.pendingOrderExpiryHours)} HOUR)) / 60), NULL) AS expires_in_h,
            s.awb, s.courier, s.tracking_url, s.estimated_delivery,
            EXISTS(SELECT 1 FROM reviews r WHERE r.order_id=o.id) AS reviewed`;
const SHIPMENT_JOIN =
  "LEFT JOIN shipments s ON s.id = (SELECT MAX(id) FROM shipments WHERE order_id = o.id)";

/** This customer's orders, newest first (session-scoped: never takes a customer id from the client). */
export async function listAccountOrders(
  customerId: number,
  limit = 50,
): Promise<AccountOrder[]> {
  const [orders] = await db().query<RowDataPacket[]>(
    `SELECT ${ORDER_COLUMNS} FROM orders o ${SHIPMENT_JOIN}
      WHERE o.customer_id=? ORDER BY o.id DESC LIMIT ?`,
    [customerId, limit],
  );
  return hydrateOrders(orders);
}

/* ── My orders page: tabs, search, date range, cursor paging ── */

export const ORDER_TABS = ["all", "active", "delivered", "cancelled"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export const ORDER_RANGES = ["30d", "6m", "year", "all"] as const;
export type OrderRange = (typeof ORDER_RANGES)[number];
export type OrderFilters = { tab: OrderTab; q: string; range: OrderRange };

const NOT_EXPIRED = `NOT (o.status='pending_payment' AND o.created_at < DATE_SUB(NOW(), INTERVAL ${Number(accountConfig.pendingOrderExpiryHours)} HOUR))`;
const TAB_SQL: Record<OrderTab, string> = {
  all: "1=1",
  active: `(o.status IN ('pending_payment','paid','cod_pending','confirmed','packed','shipped','out_for_delivery','return_requested') AND ${NOT_EXPIRED})`,
  delivered: "o.status='delivered'",
  cancelled: `(o.status IN ('cancelled','payment_failed','rto','refunded','partially_refunded') OR NOT ${NOT_EXPIRED})`,
};
const RANGE_SQL: Record<OrderRange, string> = {
  "30d": "o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
  "6m": "o.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)",
  year: "YEAR(o.created_at) = YEAR(NOW())",
  all: "1=1",
};

/** WHERE clause (minus the tab) shared by the list and the tab counts. */
function filterWhere(customerId: number, f: Omit<OrderFilters, "tab">) {
  const where = ["o.customer_id=?", RANGE_SQL[f.range]];
  const params: unknown[] = [customerId];
  const q = f.q.trim().replace(/^#/, "").slice(0, 60);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    where.push(
      "(o.order_no LIKE ? OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND oi.product_title LIKE ?))",
    );
    params.push(like, like);
  }
  return { where, params };
}

export const ORDERS_PAGE_SIZE = 10;

/** One page of orders (newest first). `cursor` is the last order id already shown. */
export async function queryAccountOrders(
  customerId: number,
  f: OrderFilters,
  cursor?: number,
): Promise<{ orders: AccountOrder[]; nextCursor: number | null }> {
  const { where, params } = filterWhere(customerId, f);
  where.push(TAB_SQL[f.tab]);
  if (cursor) {
    where.push("o.id < ?");
    params.push(cursor);
  }
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT ${ORDER_COLUMNS} FROM orders o ${SHIPMENT_JOIN}
      WHERE ${where.join(" AND ")} ORDER BY o.id DESC LIMIT ?`,
    [...params, ORDERS_PAGE_SIZE + 1],
  );
  const more = rows.length > ORDERS_PAGE_SIZE;
  const orders = await hydrateOrders(rows.slice(0, ORDERS_PAGE_SIZE));
  return { orders, nextCursor: more ? orders.at(-1)!.id : null };
}

/** Per-tab counts for the current search + date range. */
export async function countAccountOrders(
  customerId: number,
  f: Omit<OrderFilters, "tab">,
): Promise<Record<OrderTab, number>> {
  const { where, params } = filterWhere(customerId, f);
  const [[r]] = await db().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS \`all\`, SUM(${TAB_SQL.active}) AS active,
            SUM(${TAB_SQL.delivered}) AS delivered, SUM(${TAB_SQL.cancelled}) AS cancelled
       FROM orders o WHERE ${where.join(" AND ")}`,
    params,
  );
  return {
    all: Number(r?.all ?? 0),
    active: Number(r?.active ?? 0),
    delivered: Number(r?.delivered ?? 0),
    cancelled: Number(r?.cancelled ?? 0),
  };
}

async function hydrateOrders(orders: RowDataPacket[]): Promise<AccountOrder[]> {
  if (!orders.length) return [];
  const ids = orders.map((o) => Number(o.id));
  const [[items], [events]] = await Promise.all([
    db().query<RowDataPacket[]>(
      `SELECT order_id, product_handle, product_title, variant_title, variant_key, unit_price, compare_at_price, quantity
         FROM order_items WHERE order_id IN (?) ORDER BY id`,
      [ids],
    ),
    db().query<RowDataPacket[]>(
      "SELECT order_id, to_status, MIN(created_at) AS at FROM order_events WHERE order_id IN (?) GROUP BY order_id, to_status",
      [ids],
    ),
  ]);
  const itemsBy = new Map<number, AccountOrderItem[]>();
  for (const r of items) {
    const list = itemsBy.get(Number(r.order_id)) ?? [];
    const price = Number(r.unit_price);
    list.push({
      handle: String(r.product_handle),
      title: String(r.product_title),
      variant: String(r.variant_title ?? ""),
      qty: Number(r.quantity),
      price,
      mrp: Math.max(Number(r.compare_at_price ?? 0), price),
      variantKey: String(r.variant_key),
    });
    itemsBy.set(Number(r.order_id), list);
  }
  const timesBy = new Map<number, Partial<Record<number, string>>>();
  for (const e of events) {
    const step = STEP_OF[String(e.to_status)];
    if (step === undefined) continue;
    const t = timesBy.get(Number(e.order_id)) ?? {};
    const at = String(e.at);
    if (!t[step] || at < t[step]!) t[step] = at;
    timesBy.set(Number(e.order_id), t);
  }
  return orders.map((o) => {
    const id = Number(o.id);
    const times = timesBy.get(id) ?? {};
    times[0] ??= String(o.created_at);
    return {
      id,
      orderNo: String(o.order_no ?? `#${id}`),
      token: String(o.token),
      status: String(o.status),
      method: String(o.payment_method),
      total: Number(o.total),
      createdAt: String(o.created_at),
      expiresAt: o.expires_at ? String(o.expires_at) : null,
      expiresInHours: o.expires_in_h == null ? null : Number(o.expires_in_h),
      items: itemsBy.get(id) ?? [],
      courier: o.courier ? String(o.courier) : null,
      awb: o.awb ? String(o.awb) : null,
      trackingUrl: o.tracking_url ? String(o.tracking_url) : null,
      eta: o.estimated_delivery
        ? String(o.estimated_delivery).slice(0, 10)
        : null,
      stepTimes: times,
      reviewed: Boolean(Number(o.reviewed)),
    };
  });
}

/** Most-bought variants (by quantity) for "Buy your usuals". */
export async function usualVariants(
  customerId: number,
  limit = 8,
): Promise<string[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT oi.variant_key, SUM(oi.quantity) AS q FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.customer_id=? AND o.status IN (?) GROUP BY oi.variant_key ORDER BY q DESC LIMIT ?`,
    [customerId, PLACED_STATUSES, limit],
  );
  return rows.map((r) => String(r.variant_key));
}

export async function latestAddress(customerId: number) {
  const [[a]] = await db().query<RowDataPacket[]>(
    "SELECT name, phone, line1, line2, city, state, pincode FROM addresses WHERE customer_id=? ORDER BY id DESC LIMIT 1",
    [customerId],
  );
  return a
    ? {
        name: String(a.name),
        phone: String(a.phone),
        line1: String(a.line1),
        line2: String(a.line2 ?? ""),
        city: String(a.city),
        state: String(a.state),
        pincode: String(a.pincode),
      }
    : null;
}

/* ───────────────────────── Order detail ───────────────────────── */

export type AccountOrderDetail = AccountOrder & {
  address: { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string };
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shipping: number;
  codFee: number;
  mrpTotal: number;
  paidAt: string | null;
  deliveredAt: string | null;
  payment: {
    txnid: string;
    /** "payu" | "cashfree": which gateway took the payment. */
    provider: string;
    mode: string | null;
    status: string;
    at: string;
    bankRef: string | null;
    card: string | null;
    bank: string | null;
  } | null;
  cancelledAt: string | null;
  /** Real order history (oldest first) from order_events. */
  events: { to: string; actor: string; note: string | null; at: string }[];
  tracking: { status: string; location: string | null; message: string | null; at: string }[];
  refunds: { amount: number; status: string; at: string; ref: string | null }[];
  returnRequest: { status: string; reason: string; createdAt: string; items: { variantKey: string; qty: number }[] } | null;
  /** Days left to request a return (null = not returnable at all). */
  returnDaysLeft: number | null;
  /** Item categories by handle, to know which lines can be returned. */
  categories: Record<string, string>;
  hasInvoice: boolean;
};

/** Non-empty string or null (PayU's raw JSON uses "NA" / "" for missing values). */
const str = (v: unknown) => {
  const t = v == null ? "" : String(v).trim();
  return t && t !== "NA" && t !== "null" ? t : null;
};

/** One order of this customer, with everything the detail page shows. Null if it isn't theirs. */
export async function getAccountOrder(customerId: number, orderId: number): Promise<AccountOrderDetail | null> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT ${ORDER_COLUMNS}, o.customer_name, o.phone, o.address_line1, o.address_line2, o.city, o.state, o.pincode,
            o.subtotal, o.discount, o.coupon_code, o.shipping, o.cod_fee, o.paid_at, o.cancelled_at, s.delivered_at, s.id AS shipment_id,
            DATEDIFF(DATE_ADD(COALESCE(s.delivered_at,
              (SELECT MAX(e.created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'delivered')),
              INTERVAL ? DAY), NOW()) AS return_days_left
       FROM orders o ${SHIPMENT_JOIN}
      WHERE o.id=? AND o.customer_id=? LIMIT 1`,
    [accountConfig.returnWindowDays, orderId, customerId],
  );
  const r = rows[0];
  if (!r) return null;
  const [base] = await hydrateOrders([r]);
  const [[pay], [track], [refunds], [ret], [inv], [cats], [events]] = await Promise.all([
    db().query<RowDataPacket[]>(
      `SELECT txnid, provider, mode, status, updated_at,
              JSON_UNQUOTE(JSON_EXTRACT(raw, '$.bank_ref_num')) AS bank_ref,
              JSON_UNQUOTE(JSON_EXTRACT(raw, '$.cardnum')) AS cardnum,
              JSON_UNQUOTE(JSON_EXTRACT(raw, '$.bankcode')) AS bankcode
         FROM payments WHERE order_id=? ORDER BY (status='success') DESC, id DESC LIMIT 1`,
      [orderId],
    ),
    r.shipment_id
      ? db().query<RowDataPacket[]>(
          "SELECT status, location, message, event_at FROM shipment_events WHERE shipment_id=? ORDER BY event_at DESC LIMIT 20",
          [r.shipment_id],
        )
      : Promise.resolve([[] as RowDataPacket[]] as const),
    db().query<RowDataPacket[]>("SELECT amount, status, provider_ref, created_at FROM refunds WHERE order_id=? ORDER BY id DESC", [orderId]),
    db().query<RowDataPacket[]>("SELECT status, reason, items, created_at FROM order_returns WHERE order_id=? LIMIT 1", [orderId]),
    db().query<RowDataPacket[]>("SELECT 1 FROM invoices WHERE order_id=? LIMIT 1", [orderId]),
    db().query<RowDataPacket[]>(
      "SELECT DISTINCT p.handle, p.category FROM order_items oi JOIN products p ON p.handle=oi.product_handle WHERE oi.order_id=?",
      [orderId],
    ),
    db().query<RowDataPacket[]>(
      "SELECT to_status, actor, note, created_at FROM order_events WHERE order_id=? ORDER BY id ASC LIMIT 100",
      [orderId],
    ),
  ]);
  const categories = Object.fromEntries(cats.map((c) => [String(c.handle), String(c.category)]));
  const eligible = base.items.some((i) =>
    (accountConfig.returnEligibleCategories as readonly string[]).includes(categories[i.handle] ?? ""),
  );
  const daysLeft = r.return_days_left == null ? null : Number(r.return_days_left);
  const parseItems = (v: unknown) => {
    try {
      const a = typeof v === "string" ? JSON.parse(v) : v;
      return Array.isArray(a) ? (a as { variantKey: string; qty: number }[]) : [];
    } catch {
      return [];
    }
  };
  return {
    ...base,
    address: {
      name: String(r.customer_name ?? ""),
      phone: String(r.phone ?? ""),
      line1: String(r.address_line1 ?? ""),
      line2: String(r.address_line2 ?? ""),
      city: String(r.city ?? ""),
      state: String(r.state ?? ""),
      pincode: String(r.pincode ?? ""),
    },
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    couponCode: r.coupon_code ? String(r.coupon_code) : null,
    shipping: Number(r.shipping),
    codFee: Number(r.cod_fee),
    mrpTotal: base.items.reduce((s, i) => s + i.mrp * i.qty, 0),
    paidAt: r.paid_at ? String(r.paid_at) : null,
    deliveredAt: r.delivered_at ? String(r.delivered_at) : null,
    payment: pay[0]
      ? {
          txnid: String(pay[0].txnid),
          provider: String(pay[0].provider ?? "payu"),
          mode: pay[0].mode ? String(pay[0].mode) : null,
          status: String(pay[0].status),
          at: String(pay[0].updated_at),
          bankRef: str(pay[0].bank_ref),
          card: str(pay[0].cardnum),
          bank: str(pay[0].bankcode),
        }
      : null,
    cancelledAt: r.cancelled_at ? String(r.cancelled_at) : null,
    events: events.map((e) => ({
      to: String(e.to_status),
      actor: String(e.actor),
      note: e.note ? String(e.note) : null,
      at: String(e.created_at),
    })),
    tracking: track.map((t) => ({
      status: String(t.status),
      location: t.location ? String(t.location) : null,
      message: t.message ? String(t.message) : null,
      at: String(t.event_at),
    })),
    refunds: refunds.map((f) => ({
      amount: Number(f.amount),
      status: String(f.status),
      at: String(f.created_at),
      ref: str(f.provider_ref),
    })),
    returnRequest: ret[0]
      ? {
          status: String(ret[0].status),
          reason: String(ret[0].reason),
          createdAt: String(ret[0].created_at),
          items: parseItems(ret[0].items),
        }
      : null,
    returnDaysLeft: base.status === "delivered" && eligible && daysLeft !== null ? daysLeft : null,
    categories,
    hasInvoice: inv.length > 0,
  };
}
