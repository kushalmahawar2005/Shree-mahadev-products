import "server-only";
import { randomBytes } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";

export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "paid"
  | "cod_pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "rto"
  | "refunded";

export type PaymentMethod = "payu" | "cod";
type Actor = "system" | "customer" | "admin" | "payu" | "nimbuspost";

export type OrderAddress = {
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderItemInput = {
  variantKey: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  sku?: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
};

export type Order = {
  id: number;
  orderNo: string;
  token: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  address: OrderAddress;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  total: number;
  courierId: string | null;
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  createdAt: string;
  items: (OrderItemInput & { lineTotal: number })[];
};

type Row = RowDataPacket & Record<string, never>;

function toOrder(r: RowDataPacket, items: RowDataPacket[]): Order {
  return {
    id: r.id,
    orderNo: r.order_no,
    token: r.token,
    status: r.status,
    paymentMethod: r.payment_method,
    address: {
      name: r.customer_name, phone: r.phone, email: r.email, line1: r.address_line1,
      line2: r.address_line2 ?? undefined, city: r.city, state: r.state, pincode: r.pincode,
    },
    subtotal: r.subtotal,
    discount: r.discount,
    shipping: r.shipping,
    codFee: r.cod_fee,
    total: r.total,
    courierId: r.courier_id ?? null,
    courierName: r.ship_courier ?? r.courier_name ?? null,
    awb: r.awb ?? null,
    trackingUrl: r.tracking_url ?? null,
    createdAt: r.created_at,
    items: items
      .filter((i) => i.order_id === r.id)
      .map((i) => ({
        variantKey: i.variant_key, productHandle: i.product_handle, productTitle: i.product_title,
        variantTitle: i.variant_title, sku: i.sku ?? undefined, unitPrice: i.unit_price,
        compareAtPrice: i.compare_at_price ?? undefined, quantity: i.quantity, lineTotal: i.line_total,
      })),
  };
}

const ORDER_SELECT = `SELECT o.*, s.awb, s.courier AS ship_courier, s.tracking_url FROM orders o
  LEFT JOIN shipments s ON s.id = (SELECT MAX(id) FROM shipments WHERE order_id = o.id)`;

async function logEvent(conn: PoolConnection | ReturnType<typeof db>, orderId: number, from: string | null, to: string, actor: Actor, note?: string) {
  await conn.execute(
    "INSERT INTO order_events (order_id, from_status, to_status, actor, note) VALUES (?,?,?,?,?)",
    [orderId, from, to, actor, note?.slice(0, 500) ?? null],
  );
}

async function inTx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function createOrder(input: {
  method: PaymentMethod;
  address: OrderAddress;
  items: OrderItemInput[];
  subtotal: number;
  shipping: number;
  codFee: number;
  courierId: string | null;
  courierName: string | null;
  cartToken?: string;
}): Promise<{ id: number; orderNo: string; token: string }> {
  return inTx(async (conn) => {
    const a = input.address;
    // Guest customer keyed by phone; latest name/email win.
    await conn.execute(
      `INSERT INTO customers (phone, email, name) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), id = LAST_INSERT_ID(id)`,
      [a.phone, a.email, a.name],
    );
    const [[{ cid }]] = await conn.query<RowDataPacket[]>("SELECT LAST_INSERT_ID() AS cid");
    await conn.execute(
      "INSERT INTO addresses (customer_id, name, phone, line1, line2, city, state, pincode) VALUES (?,?,?,?,?,?,?,?)",
      [cid, a.name, a.phone, a.line1, a.line2 ?? null, a.city, a.state, a.pincode],
    );

    let cartId: number | null = null;
    if (input.cartToken) {
      const [r] = await conn.execute<RowDataPacket[]>("SELECT id FROM carts WHERE token = ? AND status = 'active'", [input.cartToken]);
      cartId = (r[0]?.id as number) ?? null;
    }

    const token = randomBytes(16).toString("hex");
    const status: OrderStatus = input.method === "cod" ? "cod_pending" : "pending_payment";
    const total = input.subtotal + input.shipping + input.codFee;
    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO orders (token, customer_id, cart_id, status, payment_method, customer_name, phone, email,
         address_line1, address_line2, city, state, pincode, subtotal, shipping, cod_fee, courier_id, courier_name, total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [token, cid, cartId, status, input.method, a.name, a.phone, a.email, a.line1, a.line2 ?? null, a.city, a.state,
       a.pincode, input.subtotal, input.shipping, input.codFee, input.courierId, input.courierName, total],
    );
    const id = res.insertId;
    const orderNo = `SMP${1000 + id}`;
    await conn.execute("UPDATE orders SET order_no = ? WHERE id = ?", [orderNo, id]);
    for (const it of input.items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, variant_key, product_handle, product_title, variant_title, sku,
           unit_price, compare_at_price, quantity, line_total) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, it.variantKey, it.productHandle, it.productTitle, it.variantTitle, it.sku ?? null, it.unitPrice,
         it.compareAtPrice ?? null, it.quantity, it.unitPrice * it.quantity],
      );
    }
    await logEvent(conn, id, null, status, "customer", input.method === "cod" ? "COD order placed" : "Order created, awaiting payment");

    if (cartId) {
      // COD = done now. PayU = converted only once paid (see markPaid), so failed payments stay recoverable.
      await conn.execute(
        input.method === "cod"
          ? "UPDATE carts SET order_id = ?, customer_id = ?, status = 'converted', converted_at = NOW() WHERE id = ?"
          : "UPDATE carts SET order_id = ?, customer_id = ? WHERE id = ?",
        [id, cid, cartId],
      );
    }
    return { id, orderNo, token };
  });
}

async function loadOne(where: string, value: string | number): Promise<Order | null> {
  const [rows] = await db().execute<Row[]>(`${ORDER_SELECT} WHERE ${where} = ? LIMIT 1`, [value]);
  if (!rows[0]) return null;
  const [items] = await db().execute<Row[]>("SELECT * FROM order_items WHERE order_id = ?", [rows[0].id]);
  return toOrder(rows[0], items);
}

export const getOrderById = (id: number) => loadOne("o.id", id);

export const getOrderByToken = (token: string) =>
  /^[a-f0-9]{32}$/.test(token) ? loadOne("o.token", token) : Promise.resolve(null);

// ───────────── Payments ─────────────

/** New PayU txnid per attempt (PayU rejects reused txnids). */
export async function startPaymentAttempt(order: Order): Promise<string> {
  const txnid = `${order.orderNo}T${Date.now().toString(36)}`.slice(0, 25);
  await inTx(async (conn) => {
    await conn.execute("INSERT INTO payments (order_id, txnid, amount) VALUES (?,?,?)", [order.id, txnid, order.total]);
    if (order.status === "payment_failed") {
      await conn.execute("UPDATE orders SET status = 'pending_payment' WHERE id = ?", [order.id]);
      await logEvent(conn, order.id, "payment_failed", "pending_payment", "customer", "Retrying payment");
    }
  });
  return txnid;
}

export async function getPayment(txnid: string) {
  const [rows] = await db().execute<Row[]>("SELECT id, order_id, amount, status FROM payments WHERE txnid = ?", [txnid]);
  const p = rows[0];
  if (!p) return null;
  const [o] = await db().execute<Row[]>("SELECT token FROM orders WHERE id = ?", [p.order_id]);
  return { id: p.id as number, orderId: p.order_id as number, amount: p.amount as number, status: p.status as string, orderToken: o[0]?.token as string };
}

export async function logWebhook(source: "payu", ref: string | null, payload: unknown, event?: string) {
  await db().execute("INSERT INTO webhook_logs (source, event, ref, payload) VALUES (?,?,?,?)", [
    source, event ?? null, ref, JSON.stringify(payload),
  ]);
}

export async function markPaid(paymentId: number, orderId: number, p: { mihpayid?: string; mode?: string }) {
  await inTx(async (conn) => {
    await conn.execute("UPDATE payments SET status = 'success', mihpayid = ?, mode = ?, error = NULL WHERE id = ?", [
      p.mihpayid ?? null, p.mode ?? null, paymentId,
    ]);
    const [r] = await conn.execute<ResultSetHeader>(
      "UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ? AND status IN ('pending_payment','payment_failed')",
      [orderId],
    );
    if (r.affectedRows) {
      await logEvent(conn, orderId, "pending_payment", "paid", "payu", `PayU ${p.mode ?? ""} ${p.mihpayid ?? ""}`.trim());
      await conn.execute("UPDATE carts SET status = 'converted', converted_at = NOW() WHERE order_id = ?", [orderId]);
    }
  });
}

export async function markPaymentFailed(paymentId: number, orderId: number, error: string, status: "failed" | "pending" = "failed") {
  await inTx(async (conn) => {
    await conn.execute("UPDATE payments SET status = ?, error = ? WHERE id = ?", [status, error.slice(0, 255), paymentId]);
    if (status === "failed") {
      const [r] = await conn.execute<ResultSetHeader>(
        "UPDATE orders SET status = 'payment_failed' WHERE id = ? AND status = 'pending_payment'",
        [orderId],
      );
      if (r.affectedRows) await logEvent(conn, orderId, "pending_payment", "payment_failed", "payu", error);
    }
  });
}

// ───────────── Admin ─────────────

export type OrderFilter = "all" | "to_ship" | "awaiting_payment" | "shipped" | "delivered" | "cancelled";

const FILTER_SQL: Record<OrderFilter, string> = {
  all: "o.status <> 'pending_payment' OR o.created_at > NOW() - INTERVAL 1 DAY",
  to_ship: "o.status IN ('paid','cod_pending','confirmed','packed')",
  awaiting_payment: "o.status IN ('pending_payment','payment_failed')",
  shipped: "o.status = 'shipped'",
  delivered: "o.status = 'delivered'",
  cancelled: "o.status IN ('cancelled','rto','refunded')",
};

/** Paginated admin list. Two queries per page (orders + their items), never one per order. */
export async function listOrders(opts: { page?: number; perPage?: number; filter?: OrderFilter; q?: string } = {}) {
  const perPage = Math.min(Math.max(opts.perPage ?? 25, 5), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const where: string[] = [`(${FILTER_SQL[opts.filter ?? "all"]})`];
  const params: (string | number)[] = [];
  const q = opts.q?.trim();
  if (q) {
    where.push("(o.order_no = ? OR o.phone = ? OR o.customer_name LIKE ?)");
    params.push(q.toUpperCase(), q.replace(/\D/g, "").slice(-10), `%${q}%`);
  }
  const w = where.join(" AND ");
  const [[{ total }]] = await db().query<Row[]>(`SELECT COUNT(*) AS total FROM orders o WHERE ${w}`, params);
  const [rows] = await db().query<Row[]>(`${ORDER_SELECT} WHERE ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [
    ...params, perPage, (page - 1) * perPage,
  ]);
  if (!rows.length) return { orders: [] as Order[], total: Number(total), page, perPage };
  const [items] = await db().query<Row[]>("SELECT * FROM order_items WHERE order_id IN (?)", [rows.map((r) => r.id)]);
  return { orders: rows.map((r) => toOrder(r, items)), total: Number(total), page, perPage };
}

export async function getOrderEvents(orderId: number) {
  const [rows] = await db().execute<Row[]>(
    "SELECT from_status, to_status, actor, note, created_at FROM order_events WHERE order_id = ? ORDER BY id DESC",
    [orderId],
  );
  return rows.map((r) => ({ from: r.from_status as string | null, to: r.to_status as string, actor: r.actor as string, note: r.note as string | null, at: r.created_at as string }));
}

export async function setOrderStatus(orderId: number, to: OrderStatus, actor: Actor, note?: string) {
  await inTx(async (conn) => {
    const [r] = await conn.execute<Row[]>("SELECT status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    const from = r[0]?.status as string | undefined;
    if (!from || from === to) return;
    await conn.execute(
      `UPDATE orders SET status = ?, cancelled_at = IF(? = 'cancelled', NOW(), cancelled_at) WHERE id = ?`,
      [to, to, orderId],
    );
    await logEvent(conn, orderId, from, to, actor, note);
  });
}
