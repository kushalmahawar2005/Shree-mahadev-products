import "server-only";
import { randomBytes } from "node:crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { db } from "./db";
import { notifyOrder } from "./mail";
import { queueOrderWhatsApp } from "./whatsapp";
import { ensureInvoiceForOrder } from "./invoices";
import { queueMarketingEvent } from "./marketing";
import { calculateCoupon } from "./coupons";
import {
  commitStock,
  releaseExpiredHolds,
  reholdStock,
  returnStock,
  takeStock,
} from "./inventory";

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
  | "refunded"
  | "partially_refunded";

export type PaymentMethod = "payu" | "cod" | "offline";
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
  couponCode: string | null;
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
      name: r.customer_name,
      phone: r.phone,
      email: r.email,
      line1: r.address_line1,
      line2: r.address_line2 ?? undefined,
      city: r.city,
      state: r.state,
      pincode: r.pincode,
    },
    subtotal: r.subtotal,
    discount: r.discount,
    couponCode: r.coupon_code ?? null,
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
        variantKey: i.variant_key,
        productHandle: i.product_handle,
        productTitle: i.product_title,
        variantTitle: i.variant_title,
        sku: i.sku ?? undefined,
        unitPrice: i.unit_price,
        compareAtPrice: i.compare_at_price ?? undefined,
        quantity: i.quantity,
        lineTotal: i.line_total,
      })),
  };
}

const ORDER_SELECT = `SELECT o.*, s.awb, s.courier AS ship_courier, s.tracking_url FROM orders o
  LEFT JOIN shipments s ON s.id = (SELECT MAX(id) FROM shipments WHERE order_id = o.id)`;

async function logEvent(
  conn: PoolConnection | ReturnType<typeof db>,
  orderId: number,
  from: string | null,
  to: string,
  actor: Actor,
  note?: string,
) {
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
  source?: "web" | "admin";
  address: OrderAddress;
  items: OrderItemInput[];
  priceOverrides?: Record<string, number>;
  couponCode?: string;
  subtotal: number;
  shipping: number;
  codFee: number;
  courierId: string | null;
  courierName: string | null;
  cartToken?: string;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<{ id: number; orderNo: string; token: string }> {
  if (input.method === "offline" && input.source !== "admin") {
    throw new Error("Offline payment orders can only be created by an admin.");
  }
  if (input.priceOverrides && input.source !== "admin") {
    throw new Error(
      "Price overrides can only be used for admin-created orders.",
    );
  }
  const overrides = input.priceOverrides ?? {};
  if (
    Object.values(overrides).some(
      (price) => !Number.isSafeInteger(price) || price < 1 || price > 500_000,
    )
  ) {
    throw new Error("Invalid admin price override.");
  }
  const items = input.items.map((item) => ({
    ...item,
    unitPrice: overrides[item.variantKey] ?? item.unitPrice,
  }));
  if (
    input.source === "admin" &&
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) !==
      input.subtotal
  ) {
    throw new Error("Manual order subtotal does not match its line items.");
  }
  // Free stock from abandoned PayU attempts before checking availability.
  await releaseExpiredHolds().catch((e) =>
    console.error("releaseExpiredHolds", e),
  );
  const created = await inTx(async (conn) => {
    const a = input.address;
    let discount = 0;
    let couponCode: string | null = null;
    let freeShipping = false;
    if (input.couponCode) {
      const quote = await calculateCoupon(
        input.couponCode,
        input.subtotal,
        a.phone,
        items.map((item) => ({
          productHandle: item.productHandle,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        conn,
      );
      discount = quote.discount;
      couponCode = quote.code;
      freeShipping = quote.freeShipping;
    }
    const finalShipping = freeShipping ? 0 : input.shipping;
    // Guest customer keyed by phone; latest name/email win.
    await conn.execute(
      `INSERT INTO customers (phone, email, name) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), id = LAST_INSERT_ID(id)`,
      [a.phone, a.email, a.name],
    );
    const [[{ cid }]] = await conn.query<RowDataPacket[]>(
      "SELECT LAST_INSERT_ID() AS cid",
    );
    await conn.execute(
      "INSERT INTO addresses (customer_id, name, phone, line1, line2, city, state, pincode) VALUES (?,?,?,?,?,?,?,?)",
      [
        cid,
        a.name,
        a.phone,
        a.line1,
        a.line2 ?? null,
        a.city,
        a.state,
        a.pincode,
      ],
    );

    let cartId: number | null = null;
    let attribution: Record<string, unknown> = {};
    if (input.cartToken) {
      const [r] = await conn.execute<RowDataPacket[]>(
        `SELECT id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
           fbclid, fbc, fbp, gclid, client_id, landing_page, referrer, marketing_consent
         FROM carts WHERE token = ? AND status = 'active'`,
        [input.cartToken],
      );
      cartId = (r[0]?.id as number) ?? null;
      if (r[0]) {
        attribution = {
          utm_source: r[0].utm_source,
          utm_medium: r[0].utm_medium,
          utm_campaign: r[0].utm_campaign,
          utm_content: r[0].utm_content,
          utm_term: r[0].utm_term,
          fbclid: r[0].fbclid,
          fbc: r[0].fbc,
          fbp: r[0].fbp,
          gclid: r[0].gclid,
          client_id: r[0].client_id,
          landing_page: r[0].landing_page,
          referrer: r[0].referrer,
          marketing_consent: r[0].marketing_consent,
        };
      }
    }

    const token = randomBytes(16).toString("hex");
    const status: OrderStatus =
      input.method === "cod"
        ? "cod_pending"
        : input.method === "offline"
          ? "paid"
          : "pending_payment";
    const total = input.subtotal - discount + finalShipping + input.codFee;
    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO orders (token, customer_id, cart_id, source, status, payment_method, customer_name, phone, email,
         address_line1, address_line2, city, state, pincode, subtotal, discount, coupon_code, shipping, cod_fee, courier_id, courier_name, total,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbc, fbp, gclid, client_id,
         landing_page, referrer, marketing_consent, client_ip, user_agent, paid_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?=1,NOW(),NULL))`,
      [
        token,
        cid,
        cartId,
        input.source ?? "web",
        status,
        input.method,
        a.name,
        a.phone,
        a.email,
        a.line1,
        a.line2 ?? null,
        a.city,
        a.state,
        a.pincode,
        input.subtotal,
        discount,
        couponCode,
        finalShipping,
        input.codFee,
        input.courierId,
        input.courierName,
        total,
        attribution.utm_source ?? null,
        attribution.utm_medium ?? null,
        attribution.utm_campaign ?? null,
        attribution.utm_content ?? null,
        attribution.utm_term ?? null,
        attribution.fbclid ?? null,
        attribution.fbc ?? null,
        attribution.fbp ?? null,
        attribution.gclid ?? null,
        attribution.client_id ?? null,
        attribution.landing_page ?? null,
        attribution.referrer ?? null,
        attribution.marketing_consent ? 1 : 0,
        input.clientIp ?? null,
        input.userAgent?.slice(0, 255) ?? null,
        input.method === "offline" ? 1 : 0,
      ],
    );
    const id = res.insertId;
    const orderNo = `SMP${1000 + id}`;
    await conn.execute("UPDATE orders SET order_no = ? WHERE id = ?", [
      orderNo,
      id,
    ]);
    for (const it of items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, variant_key, product_handle, product_title, variant_title, sku,
           unit_price, compare_at_price, quantity, line_total) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          it.variantKey,
          it.productHandle,
          it.productTitle,
          it.variantTitle,
          it.sku ?? null,
          it.unitPrice,
          it.compareAtPrice ?? null,
          it.quantity,
          it.unitPrice * it.quantity,
        ],
      );
    }
    // Locks the variant rows; throws OutOfStockError (rolls back the whole order) if someone else got the last unit.
    await takeStock(
      conn,
      id,
      items.map((it) => ({
        variantKey: it.variantKey,
        title: `${it.productTitle} (${it.variantTitle})`,
        quantity: it.quantity,
      })),
      input.method === "payu" ? "hold" : "commit",
    );
    if (couponCode && input.method === "cod") {
      const [[coupon]] = await conn.execute<RowDataPacket[]>(
        "SELECT id FROM coupons WHERE code=?",
        [couponCode],
      );
      await conn.execute(
        "INSERT INTO coupon_redemptions (coupon_id, order_id, phone, amount) VALUES (?,?,?,?)",
        [coupon.id, id, a.phone, discount],
      );
      await conn.execute(
        "UPDATE coupons SET used_count=used_count+1 WHERE id=?",
        [coupon.id],
      );
    }
    await logEvent(
      conn,
      id,
      null,
      status,
      input.source === "admin" ? "admin" : "customer",
      input.method === "cod"
        ? "COD order placed"
        : input.method === "offline"
          ? "Manual order marked paid offline"
          : "Order created, awaiting payment",
    );

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
  if (input.method === "cod" || input.method === "offline") {
    await ensureInvoiceForOrder(created.id).catch((error) => console.error("Invoice could not be created", created.orderNo, error));
    void queueMarketingEvent("Purchase", created.orderNo, created.id);
  }
  return created;
}

async function loadOne(
  where: string,
  value: string | number,
): Promise<Order | null> {
  const [rows] = await db().execute<Row[]>(
    `${ORDER_SELECT} WHERE ${where} = ? LIMIT 1`,
    [value],
  );
  if (!rows[0]) return null;
  const [items] = await db().execute<Row[]>(
    "SELECT * FROM order_items WHERE order_id = ?",
    [rows[0].id],
  );
  return toOrder(rows[0], items);
}

export const getOrderById = (id: number) => loadOne("o.id", id);

export const getOrderByToken = (token: string) =>
  /^[a-f0-9]{32}$/.test(token)
    ? loadOne("o.token", token)
    : Promise.resolve(null);

// ───────────── Payments ─────────────

/** New PayU txnid per attempt (PayU rejects reused txnids). */
export async function startPaymentAttempt(order: Order): Promise<string> {
  const txnid = `${order.orderNo}T${Date.now().toString(36)}`.slice(0, 25);
  await inTx(async (conn) => {
    await reholdStock(
      conn,
      order.id,
      new Map(
        order.items.map((i) => [
          i.variantKey,
          `${i.productTitle} (${i.variantTitle})`,
        ]),
      ),
    );
    await conn.execute(
      "INSERT INTO payments (order_id, txnid, amount) VALUES (?,?,?)",
      [order.id, txnid, order.total],
    );
    if (order.status === "payment_failed") {
      await conn.execute(
        "UPDATE orders SET status = 'pending_payment' WHERE id = ?",
        [order.id],
      );
      await logEvent(
        conn,
        order.id,
        "payment_failed",
        "pending_payment",
        "customer",
        "Retrying payment",
      );
    }
  });
  return txnid;
}

export async function getPayment(txnid: string) {
  const [rows] = await db().execute<Row[]>(
    "SELECT id, order_id, amount, status FROM payments WHERE txnid = ?",
    [txnid],
  );
  const p = rows[0];
  if (!p) return null;
  const [o] = await db().execute<Row[]>(
    "SELECT token FROM orders WHERE id = ?",
    [p.order_id],
  );
  return {
    id: p.id as number,
    orderId: p.order_id as number,
    amount: p.amount as number,
    status: p.status as string,
    orderToken: o[0]?.token as string,
  };
}

export async function logWebhook(
  source: "payu",
  ref: string | null,
  payload: unknown,
  event?: string,
) {
  await db().execute(
    "INSERT INTO webhook_logs (source, event, ref, payload) VALUES (?,?,?,?)",
    [source, event ?? null, ref, JSON.stringify(payload)],
  );
}

export async function markPaid(
  paymentId: number,
  orderId: number,
  p: { mihpayid?: string; mode?: string },
) {
  await inTx(async (conn) => {
    await conn.execute(
      "UPDATE payments SET status = 'success', mihpayid = ?, mode = ?, error = NULL WHERE id = ?",
      [p.mihpayid ?? null, p.mode ?? null, paymentId],
    );
    const [r] = await conn.execute<ResultSetHeader>(
      "UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ? AND status IN ('pending_payment','payment_failed')",
      [orderId],
    );
    if (r.affectedRows) {
      await logEvent(
        conn,
        orderId,
        "pending_payment",
        "paid",
        "payu",
        `PayU ${p.mode ?? ""} ${p.mihpayid ?? ""}`.trim(),
      );
      const { oversold } = await commitStock(conn, orderId);
      if (oversold)
        await logEvent(
          conn,
          orderId,
          "paid",
          "paid",
          "system",
          "Paid after the stock hold expired and stock ran short. Check inventory before packing.",
        );
      await conn.execute(
        "UPDATE carts SET status = 'converted', converted_at = NOW() WHERE order_id = ?",
        [orderId],
      );
      const [[order]] = await conn.execute<RowDataPacket[]>(
        "SELECT coupon_code, discount, phone FROM orders WHERE id=? FOR UPDATE",
        [orderId],
      );
      if (order?.coupon_code) {
        const [[coupon]] = await conn.execute<RowDataPacket[]>(
          "SELECT id FROM coupons WHERE code=? FOR UPDATE",
          [order.coupon_code],
        );
        if (coupon) {
          await conn.execute(
            "INSERT IGNORE INTO coupon_redemptions (coupon_id, order_id, phone, amount) VALUES (?,?,?,?)",
            [coupon.id, orderId, order.phone, order.discount],
          );
          await conn.execute(
            "UPDATE coupons SET used_count=(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=?) WHERE id=?",
            [coupon.id, coupon.id],
          );
        }
      }
    }
  });
  const paidOrder = await getOrderById(orderId);
  if (paidOrder) void queueMarketingEvent("Purchase", paidOrder.orderNo, orderId);
  await ensureInvoiceForOrder(orderId).catch((error) => console.error("Invoice could not be created", orderId, error));
}

export async function markPaymentFailed(
  paymentId: number,
  orderId: number,
  error: string,
  status: "failed" | "pending" = "failed",
) {
  await inTx(async (conn) => {
    await conn.execute(
      "UPDATE payments SET status = ?, error = ? WHERE id = ?",
      [status, error.slice(0, 255), paymentId],
    );
    if (status === "failed") {
      const [r] = await conn.execute<ResultSetHeader>(
        "UPDATE orders SET status = 'payment_failed' WHERE id = ? AND status = 'pending_payment'",
        [orderId],
      );
      if (r.affectedRows) {
        await logEvent(
          conn,
          orderId,
          "pending_payment",
          "payment_failed",
          "payu",
          error,
        );
        await returnStock(conn, orderId, "held", "release", "payu");
      }
    }
  });
}

// ───────────── Admin ─────────────

export type OrderFilter =
  | "all"
  | "to_ship"
  | "awaiting_payment"
  | "shipped"
  | "delivered"
  | "cancelled";

const FILTER_SQL: Record<OrderFilter, string> = {
  all: "o.status <> 'pending_payment' OR o.created_at > NOW() - INTERVAL 1 DAY",
  to_ship: "o.status IN ('paid','cod_pending','confirmed','packed')",
  awaiting_payment: "o.status IN ('pending_payment','payment_failed')",
  shipped: "o.status = 'shipped'",
  delivered: "o.status = 'delivered'",
  cancelled: "o.status IN ('cancelled','rto','refunded')",
};

/** Paginated admin list. Two queries per page (orders + their items), never one per order. */
export async function listOrders(
  opts: {
    page?: number;
    perPage?: number;
    filter?: OrderFilter;
    q?: string;
  } = {},
) {
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
  const [[{ total }]] = await db().query<Row[]>(
    `SELECT COUNT(*) AS total FROM orders o WHERE ${w}`,
    params,
  );
  const [rows] = await db().query<Row[]>(
    `${ORDER_SELECT} WHERE ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );
  if (!rows.length)
    return { orders: [] as Order[], total: Number(total), page, perPage };
  const [items] = await db().query<Row[]>(
    "SELECT * FROM order_items WHERE order_id IN (?)",
    [rows.map((r) => r.id)],
  );
  return {
    orders: rows.map((r) => toOrder(r, items)),
    total: Number(total),
    page,
    perPage,
  };
}

export async function getOrderEvents(orderId: number) {
  const [rows] = await db().execute<Row[]>(
    "SELECT from_status, to_status, actor, note, created_at FROM order_events WHERE order_id = ? ORDER BY id DESC",
    [orderId],
  );
  return rows.map((r) => ({
    from: r.from_status as string | null,
    to: r.to_status as string,
    actor: r.actor as string,
    note: r.note as string | null,
    at: r.created_at as string,
  }));
}

export async function setOrderStatus(
  orderId: number,
  to: OrderStatus,
  actor: Actor,
  note?: string,
) {
  let changed = false;
  await inTx(async (conn) => {
    const [r] = await conn.execute<Row[]>(
      "SELECT status FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    const from = r[0]?.status as string | undefined;
    if (!from || from === to) return;
    await conn.execute(
      `UPDATE orders SET status = ?, cancelled_at = IF(? = 'cancelled', NOW(), cancelled_at) WHERE id = ?`,
      [to, to, orderId],
    );
    await logEvent(conn, orderId, from, to, actor, note);
    changed = true;
    // Cancelled before delivery: whatever this order holds or took goes back (once).
    if (to === "cancelled")
      await returnStock(conn, orderId, "any", "restock", actor);
  });
  // Customer emails go out after the change is committed.
  if (changed && to === "delivered")
    await ensureInvoiceForOrder(orderId).catch((error) => console.error("Invoice could not be created", orderId, error));
  if (changed && (to === "delivered" || to === "cancelled"))
    await notifyOrder(orderId, to);
  if (changed && (to === "delivered" || to === "cancelled"))
    await queueOrderWhatsApp(orderId, to).catch((error) => console.error("WhatsApp status notification", error));
}

/** Courier returned an RTO parcel and it reached us: put the stock back (once). */
export async function markRtoReceived(orderId: number, actor: Actor) {
  return inTx(async (conn) => {
    const [r] = await conn.execute<Row[]>(
      "SELECT status FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    if (r[0]?.status !== "rto")
      throw new Error("Only RTO orders can be marked as received back");
    const n = await returnStock(
      conn,
      orderId,
      "committed",
      "rto_return",
      actor,
    );
    await logEvent(
      conn,
      orderId,
      "rto",
      "rto",
      actor,
      n
        ? "RTO parcel received back; stock returned"
        : "RTO parcel received back",
    );
    return n;
  });
}

// ───────────── Refunds (PayU) ─────────────

export async function listRefunds(orderId: number) {
  const [rows] = await db().query<Row[]>(
    "SELECT id, amount, reason, status, provider_ref, error, created_by, created_at FROM refunds WHERE order_id = ? ORDER BY id DESC",
    [orderId],
  );
  return rows.map((r) => ({
    id: r.id as number,
    amount: r.amount as number,
    reason: r.reason as string | null,
    status: r.status as string,
    ref: r.provider_ref as string | null,
    error: r.error as string | null,
    by: r.created_by as string | null,
    at: r.created_at as string,
  }));
}

/** Paid amount and what is still refundable for a PayU order. */
export async function refundableFor(orderId: number) {
  const [[pay]] = await db().query<Row[]>(
    "SELECT id, amount, mihpayid FROM payments WHERE order_id = ? AND status = 'success' ORDER BY id DESC LIMIT 1",
    [orderId],
  );
  if (!pay) return null;
  const [[r]] = await db().query<Row[]>(
    "SELECT COALESCE(SUM(amount),0) AS done FROM refunds WHERE order_id = ? AND status IN ('requested','success')",
    [orderId],
  );
  return {
    paymentId: pay.id as number,
    mihpayid: pay.mihpayid as string | null,
    paid: pay.amount as number,
    refunded: Number(r.done),
    left: (pay.amount as number) - Number(r.done),
  };
}
