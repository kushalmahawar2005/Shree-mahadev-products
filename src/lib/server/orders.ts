import "server-only";
import { randomBytes } from "node:crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { findDuplicateAddress } from "./account-addresses";
import { db } from "./db";
import { notifyOrder } from "./mail";
import { queueOrderWhatsApp } from "./whatsapp";
import { ensureCreditNotesForOrder } from "./credit-notes";
import { ensureInvoiceForOrder, ensureInvoiceIfApplicable } from "./invoices";
import { queueMarketingEvent } from "./marketing";
import { gatewayIsTest } from "./payment-gateway";
import { calculateCoupon, releaseCouponForOrder, reserveCouponForRetry } from "./coupons";
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
type Actor = "system" | "customer" | "admin" | "payu" | "cashfree" | "nimbuspost";

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
  /** Aggregator of the latest shipment (null = not shipped). */
  shipProvider: "nimbuspost" | "velocity" | null;
  trackingUrl: string | null;
  createdAt: string;
  items: (OrderItemInput & { lineTotal: number })[];
  /** Set when something unexpected needs an admin (extra payment, unclear refund/shipment…). */
  attention: string | null;
  attentionAt: string | null;
};

type Row = RowDataPacket & Record<string, never>;

function toOrder(r: RowDataPacket, items: RowDataPacket[]): Order {
  return {
    id: r.id,
    orderNo: r.order_no,
    token: r.token,
    status: r.status,
    attention: (r.attention as string | null) ?? null,
    attentionAt: (r.attention_at as string | null) ?? null,
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
    shipProvider: r.ship_provider === "velocity" ? "velocity" : r.ship_provider ? "nimbuspost" : null,
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

const ORDER_SELECT = `SELECT o.*, s.awb, s.courier AS ship_courier, s.provider AS ship_provider, s.tracking_url FROM orders o
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

/**
 * Flag an order for admin attention and record why in its timeline. Appends to an existing flag
 * (never overwrites one an admin hasn't seen). Use for anything money-related that must not fail silently.
 */
export async function flagOrder(
  conn: PoolConnection | ReturnType<typeof db>,
  orderId: number,
  reason: string,
  actor: Actor = "system",
) {
  const [[o]] = await conn.query<Row[]>("SELECT status FROM orders WHERE id = ?", [orderId]);
  const status = (o?.status as string | undefined) ?? "unknown";
  await conn.execute(
    `UPDATE orders SET attention = LEFT(IF(attention IS NULL OR attention = '', ?, CONCAT(attention, ' | ', ?)), 500),
       attention_at = COALESCE(attention_at, NOW()) WHERE id = ?`,
    [reason, reason, orderId],
  );
  await logEvent(conn, orderId, status, status, actor, `⚠ Needs attention: ${reason}`);
}

/** Admin cleared the flag after handling it. */
export async function clearOrderAttention(orderId: number, note?: string) {
  const [r] = await db().execute<ResultSetHeader>(
    "UPDATE orders SET attention = NULL, attention_at = NULL WHERE id = ? AND attention IS NOT NULL",
    [orderId],
  );
  if (r.affectedRows) {
    const [[o]] = await db().query<Row[]>("SELECT status FROM orders WHERE id = ?", [orderId]);
    await logEvent(db(), orderId, o?.status ?? null, String(o?.status ?? ""), "admin", `Attention resolved${note ? `: ${note}` : ""}`);
  }
}

/** Timeline note without a status change (e.g. "shipment cancelled" on an already-cancelled order). */
export async function addOrderNote(orderId: number, actor: Actor, note: string) {
  const [[o]] = await db().query<Row[]>("SELECT status FROM orders WHERE id = ?", [orderId]);
  if (!o) return;
  await logEvent(db(), orderId, o.status, o.status, actor, note);
}

export async function inTx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
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
  source?: "web" | "admin" | "chat";
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
  /** Optional buyer GSTIN for a business (B2B) invoice; validated by the caller. */
  customerGstin?: string | null;
}): Promise<{ id: number; orderNo: string; token: string; reused?: boolean }> {
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
  let superseded: number | null = null;
  const created = await inTx(async (conn): Promise<{ id: number; orderNo: string; token: string; reused?: boolean }> => {
    // Double submit / two tabs / network retry: lock this cart; if it already became an order moments
    // ago with the same method and amount, hand that order back instead of creating a second one.
    if (input.cartToken) {
      const [[cart]] = await conn.execute<RowDataPacket[]>("SELECT id, order_id FROM carts WHERE token = ? FOR UPDATE", [input.cartToken]);
      if (cart?.order_id) {
        const [[dup]] = await conn.execute<RowDataPacket[]>(
          `SELECT id, order_no, token FROM orders WHERE id = ? AND payment_method = ? AND subtotal = ?
             AND status IN ('pending_payment','cod_pending') AND created_at > NOW() - INTERVAL 10 MINUTE`,
          [cart.order_id, input.method, input.subtotal],
        );
        if (dup) return { id: Number(dup.id), orderNo: String(dup.order_no), token: String(dup.token), reused: true };
        // The shopper left an unpaid online order from this cart and is checking out again (cart changed):
        // free that order's coupon use now so it doesn't block this one; the old order itself is
        // cancelled right after this commit (its stock hold released). A payment that still lands on it
        // later is flagged as an extra payment for refund.
        const [[old]] = await conn.execute<RowDataPacket[]>(
          "SELECT id FROM orders WHERE id = ? AND payment_method = 'payu' AND status IN ('pending_payment','payment_failed') FOR UPDATE",
          [cart.order_id],
        );
        if (old) {
          superseded = Number(old.id);
          await releaseCouponForOrder(conn, superseded);
        }
      }
    }
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
    // Save the address to the book only once (repeat orders to the same place reuse it).
    const existing = await findDuplicateAddress(conn, Number(cid), a);
    if (!existing) await conn.execute(
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
         landing_page, referrer, marketing_consent, client_ip, user_agent, paid_at, customer_gstin)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?=1,NOW(),NULL),?)`,
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
        input.customerGstin?.trim().toUpperCase().slice(0, 15) || null,
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
    // Reserve the coupon use now for every payment method (the coupon row is locked by calculateCoupon),
    // so pending PayU orders count against usage / per-phone limits. Released again if the payment
    // fails or the order is cancelled (releaseCouponForOrder).
    if (couponCode) {
      const [[coupon]] = await conn.execute<RowDataPacket[]>(
        "SELECT id FROM coupons WHERE code=?",
        [couponCode],
      );
      await conn.execute(
        "INSERT INTO coupon_redemptions (coupon_id, order_id, phone, amount) VALUES (?,?,?,?)",
        [coupon.id, id, a.phone, discount],
      );
      await conn.execute(
        "UPDATE coupons SET used_count=(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=?) WHERE id=?",
        [coupon.id, coupon.id],
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
  if (superseded && !created.reused && superseded !== created.id)
    await setOrderStatus(superseded, "cancelled", "system", `Replaced by a new checkout (${created.orderNo})`, {
      onlyFrom: ["pending_payment", "payment_failed"],
      quiet: true,
      silent: true,
    }).catch((e) => console.error("Could not cancel superseded order", superseded, e));
  if (!created.reused && (input.method === "cod" || input.method === "offline")) {
    await ensureInvoiceIfApplicable(created.id).catch((error) => console.error("Invoice could not be created", created.orderNo, error));
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

/**
 * Payment attempt for this visit to the pay page. PayU: always a new txnid (PayU rejects reused ones).
 * Cashfree: reuses an open attempt from the last 10 minutes, because the pay page can render more than
 * once per visit (dev double renders, reloads) and each new attempt would be a new Cashfree order.
 * The order row is locked first, so renders arriving together still end up with one attempt.
 */
export async function startPaymentAttempt(order: Order, provider: "payu" | "cashfree" = "payu"): Promise<string> {
  let txnid = `${order.orderNo}T${Date.now().toString(36)}`.slice(0, 25);
  await inTx(async (conn) => {
    await conn.execute("SELECT id FROM orders WHERE id = ? FOR UPDATE", [order.id]);
    if (provider === "cashfree") {
      const [open] = await conn.execute<Row[]>(
        `SELECT txnid FROM payments WHERE order_id = ? AND provider = 'cashfree' AND status = 'initiated'
           AND created_at > NOW() - INTERVAL 10 MINUTE ORDER BY id DESC LIMIT 1`,
        [order.id],
      );
      if (open[0]) {
        txnid = String(open[0].txnid);
        return; // stock and coupon are already held for this attempt
      }
    }
    // Retrying after a failed / expired attempt: the coupon use was given back, take it again (or refuse).
    await reserveCouponForRetry(conn, order.id);
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
      "INSERT INTO payments (order_id, provider, txnid, amount) VALUES (?,?,?,?)",
      [order.id, provider, txnid, order.total],
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
    "SELECT id, order_id, amount, status, provider FROM payments WHERE txnid = ?",
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
    provider: (p.provider as string) === "cashfree" ? ("cashfree" as const) : ("payu" as const),
    orderToken: o[0]?.token as string,
  };
}

export async function logWebhook(
  source: "payu" | "cashfree",
  ref: string | null,
  payload: unknown,
  event?: string,
) {
  await db().execute(
    "INSERT INTO webhook_logs (source, event, ref, payload) VALUES (?,?,?,?)",
    [source, event ?? null, ref, JSON.stringify(payload)],
  );
}

/**
 * Outcome of applying a PayU success.
 * - `paid`: this call moved the order to paid. Only then may callers send emails / WhatsApp.
 * - `duplicate`: this payment was already recorded as success (callback + webhook race, retries).
 * - `extra`: money arrived but the order was not waiting for it (cancelled, or already paid by another
 *   attempt). The order is flagged for a manual refund; nothing is sent to the customer.
 */
export type MarkPaidResult = "paid" | "duplicate" | "extra";

export async function markPaid(
  paymentId: number,
  orderId: number,
  p: { mihpayid?: string; mode?: string },
): Promise<MarkPaidResult> {
  const result = await inTx(async (conn): Promise<MarkPaidResult> => {
    // Lock the order first so a concurrent cancel / failure / second attempt serialises with us.
    const [[o]] = await conn.execute<Row[]>(
      "SELECT status FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    const [[gwRow]] = await conn.execute<Row[]>("SELECT provider FROM payments WHERE id = ?", [paymentId]);
    const actor: Actor = gwRow?.provider === "cashfree" ? "cashfree" : "payu";
    const [pr] = await conn.execute<ResultSetHeader>(
      "UPDATE payments SET status = 'success', mihpayid = ?, mode = ?, error = NULL WHERE id = ? AND status <> 'success'",
      [p.mihpayid ?? null, p.mode ?? null, paymentId],
    );
    if (!pr.affectedRows) return "duplicate";
    const [r] = await conn.execute<ResultSetHeader>(
      "UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ? AND status IN ('pending_payment','payment_failed')",
      [orderId],
    );
    if (!r.affectedRows) {
      const [[pay]] = await conn.execute<Row[]>("SELECT amount, txnid, provider FROM payments WHERE id = ?", [paymentId]);
      const gw = pay?.provider === "cashfree" ? "Cashfree" : "PayU";
      await flagOrder(
        conn,
        orderId,
        `Extra payment ₹${pay?.amount ?? "?"} received (${gw} ${pay?.txnid ?? paymentId}${p.mihpayid ? ` / ${p.mihpayid}` : ""}) while the order was "${o?.status ?? "unknown"}". Refund it from the order's Refund panel or the ${gw} dashboard.`,
        actor,
      );
      return "extra";
    }
    {
      await logEvent(
        conn,
        orderId,
        String(o?.status ?? "pending_payment"),
        "paid",
        actor,
        `${actor === "cashfree" ? "Cashfree" : "PayU"} ${p.mode ?? ""} ${p.mihpayid ?? ""}`.trim(),
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
    return "paid";
  });
  // Pixel + invoice only when this call really moved the order to paid.
  if (result === "paid") {
    // A test/sandbox gateway "payment" moves no money: flag it so nobody ships it by mistake,
    // and keep it out of the ad pixels.
    const [[pv]] = await db().execute<Row[]>("SELECT provider FROM payments WHERE id = ?", [paymentId]);
    const test = gatewayIsTest(String(pv?.provider ?? "payu"));
    if (test) await flagOrder(db(), orderId, "Test-mode payment: no real money received. Do not ship.", "system").catch((e) => console.error("flag test payment", e));
    const paidOrder = await getOrderById(orderId);
    if (paidOrder && !test) void queueMarketingEvent("Purchase", paidOrder.orderNo, orderId);
    await ensureInvoiceForOrder(orderId).catch((error) => console.error("Invoice could not be created", orderId, error));
  }
  return result;
}

/**
 * Record a failed (or still pending) PayU attempt. Never downgrades a payment that already succeeded,
 * and only fails the order / releases its stock hold when no other attempt on the order is still open
 * or paid (a late failure for an old attempt must not free the stock of a live retry).
 */
export async function markPaymentFailed(
  paymentId: number,
  orderId: number,
  error: string,
  status: "failed" | "pending" = "failed",
) {
  await inTx(async (conn) => {
    await conn.execute("SELECT id FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    const [[gwRow]] = await conn.execute<Row[]>("SELECT provider FROM payments WHERE id = ?", [paymentId]);
    const actor: Actor = gwRow?.provider === "cashfree" ? "cashfree" : "payu";
    const [pr] = await conn.execute<ResultSetHeader>(
      "UPDATE payments SET status = ?, error = ? WHERE id = ? AND status <> 'success'",
      [status, error.slice(0, 255), paymentId],
    );
    if (!pr.affectedRows || status !== "failed") return;
    const [others] = await conn.execute<Row[]>(
      "SELECT 1 FROM payments WHERE order_id = ? AND id <> ? AND status IN ('initiated','pending','success') LIMIT 1",
      [orderId, paymentId],
    );
    if (others.length) return;
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
        actor,
        error,
      );
      await returnStock(conn, orderId, "held", "release", actor);
      await releaseCouponForOrder(conn, orderId);
    }
  });
}

// ───────────── Admin ─────────────

export type OrderFilter =
  | "needs_action"
  | "all"
  | "to_ship"
  | "awaiting_payment"
  | "shipped"
  | "delivered"
  | "cancelled";

const FILTER_SQL: Record<OrderFilter, string> = {
  // Flagged orders (extra payment, unclear refund/shipment, cancel request) always need action, whatever the status.
  needs_action: "(o.status IN ('paid','cod_pending','confirmed','packed','pending_payment','payment_failed','rto') OR o.attention IS NOT NULL)",
  all: "1=1",
  to_ship: "o.status IN ('paid','cod_pending','confirmed','packed')",
  awaiting_payment: "o.status IN ('pending_payment','payment_failed')",
  shipped: "o.status = 'shipped'",
  delivered: "o.status = 'delivered'",
  cancelled: "o.status IN ('cancelled','rto','refunded')",
};

/** Small global counts for the order workspace filter tabs. */
/** "YYYY-MM-DD" bounds → SQL on created_at (stored in IST, so plain date strings compare correctly). */
const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s?: string) => !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export type OrderSort = "newest" | "oldest" | "total_desc" | "total_asc";
export type OrderPay = "all" | "online" | "cod";
export const ORDER_SORTS: OrderSort[] = ["newest", "oldest", "total_desc", "total_asc"];
export const ORDER_PAYS: OrderPay[] = ["all", "online", "cod"];

/** Admin list scope shared by the list, the tab counts and the CSV export. */
export type OrderScope = {
  /** Placed on/after this day (YYYY-MM-DD), from `fromTime` (HH:MM) when given. */
  from?: string;
  /** Placed on/before this day (YYYY-MM-DD), up to `toTime` (HH:MM) when given. */
  to?: string;
  fromTime?: string;
  toTime?: string;
  pay?: OrderPay;
};

function dateWhere(scope: OrderScope = {}) {
  const { from, to, fromTime, toTime, pay } = scope;
  const where: string[] = [];
  const params: string[] = [];
  if (isDay(from)) {
    where.push("o.created_at >= ?");
    params.push(`${from} ${isTime(fromTime) ? fromTime : "00:00"}:00`);
  }
  if (isDay(to)) {
    if (isTime(toTime)) {
      where.push("o.created_at <= ?");
      params.push(`${to} ${toTime}:59`);
    } else {
      where.push("o.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(to!);
    }
  }
  if (pay === "cod") where.push("o.payment_method = 'cod'");
  else if (pay === "online") where.push("o.payment_method NOT IN ('cod','offline')");
  return { where, params };
}

export async function getOrderFilterCounts(range: OrderScope = {}): Promise<Record<OrderFilter, number>> {
  const d = dateWhere(range);
  const [[row]] = await db().query<Row[]>(
    `SELECT COUNT(*) AS all_orders,
       SUM(status IN ('paid','cod_pending','confirmed','packed','pending_payment','payment_failed','rto')) AS needs_action,
       SUM(status IN ('paid','cod_pending','confirmed','packed')) AS to_ship,
       SUM(status IN ('pending_payment','payment_failed')) AS awaiting_payment,
       SUM(status='shipped') AS shipped,
       SUM(status='delivered') AS delivered,
       SUM(status IN ('cancelled','rto','refunded')) AS cancelled
     FROM orders o${d.where.length ? ` WHERE ${d.where.join(" AND ")}` : ""}`,
    d.params,
  );
  const count = (value: unknown) => Number(value ?? 0);
  return {
    all: count(row.all_orders),
    needs_action: count(row.needs_action),
    to_ship: count(row.to_ship),
    awaiting_payment: count(row.awaiting_payment),
    shipped: count(row.shipped),
    delivered: count(row.delivered),
    cancelled: count(row.cancelled),
  };
}

/** Paginated admin list. Two queries per page (orders + their items), never one per order. */
export async function listOrders(
  opts: {
    page?: number;
    perPage?: number;
    filter?: OrderFilter;
    q?: string;
    sort?: OrderSort;
    /** Skip the count/value summary (CSV export pages through everything and doesn't need it). */
    withTotal?: boolean;
  } & OrderScope = {},
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
  const d = dateWhere(opts);
  where.push(...d.where);
  params.push(...d.params);
  const w = where.join(" AND ");
  // Count + value of everything in this view (all pages), for the summary line.
  const [[{ total, value }]] =
    opts.withTotal === false
      ? [[{ total: 0, value: 0 }]]
      : await db().query<Row[]>(`SELECT COUNT(*) AS total, COALESCE(SUM(o.total),0) AS value FROM orders o WHERE ${w}`, params);
  const [rows] = await db().query<Row[]>(
    `${ORDER_SELECT} WHERE ${w} ORDER BY ${
      // An explicit sort wins; otherwise "Needs action" shows the most urgent statuses first.
      opts.sort && opts.sort !== "newest"
        ? { oldest: "o.id ASC", total_desc: "o.total DESC, o.id DESC", total_asc: "o.total ASC, o.id DESC" }[opts.sort]
        : `${
            opts.filter === "needs_action" && !opts.sort
              ? "CASE o.status WHEN 'paid' THEN 0 WHEN 'cod_pending' THEN 1 WHEN 'confirmed' THEN 2 WHEN 'packed' THEN 3 WHEN 'rto' THEN 4 WHEN 'pending_payment' THEN 5 WHEN 'payment_failed' THEN 6 ELSE 7 END ASC, "
              : ""
          }o.id DESC`
    } LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );
  if (!rows.length)
    return { orders: [] as Order[], total: Number(total), value: Number(value), page, perPage };
  const [items] = await db().query<Row[]>(
    "SELECT * FROM order_items WHERE order_id IN (?)",
    [rows.map((r) => r.id)],
  );
  return {
    orders: rows.map((r) => toOrder(r, items)),
    total: Number(total),
    value: Number(value),
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

/**
 * Which statuses an order may move INTO from where. Anything else is an illegal jump (e.g.
 * delivered → cancelled, cancelled → confirmed, pending_payment → delivered) and is refused.
 * - cancelled only before dispatch, so a cancel never restocks goods that are with the courier (RTO
 *   handles returns, and its stock comes back via markRtoReceived).
 * - courier updates can move forward (packed → shipped → delivered, shipped/delivered → rto) but never
 *   reopen a cancelled / refunded order.
 */
const ALLOWED_FROM: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["payment_failed"],
  payment_failed: ["pending_payment"],
  paid: ["pending_payment", "payment_failed", "packed"],
  cod_pending: ["packed"],
  confirmed: ["paid", "cod_pending"],
  packed: ["paid", "cod_pending", "confirmed"],
  shipped: ["paid", "cod_pending", "confirmed", "packed"],
  delivered: ["packed", "shipped"],
  rto: ["packed", "shipped", "delivered"],
  cancelled: ["pending_payment", "payment_failed", "paid", "cod_pending", "confirmed", "packed"],
  refunded: ["paid", "confirmed", "packed", "shipped", "delivered", "rto", "cancelled", "partially_refunded"],
  partially_refunded: ["paid", "confirmed", "packed", "shipped", "delivered", "rto", "cancelled"],
};

export class IllegalStatusChangeError extends Error {}

/** Automated sources (courier tracking, PayU, cron) skip illegal moves quietly instead of failing. */
const QUIET_ACTORS: readonly Actor[] = ["nimbuspost", "payu", "system"];

/**
 * Move an order to `to` (locked, logged once). Returns true only when the status actually changed,
 * so callers can gate customer messages on it.
 * - `onlyFrom`: change only if the current status is one of these (checked under the row lock).
 * - `restock`: also return held/taken stock (used by a full refund of an order that never shipped).
 * - `quiet`: an illegal move returns false instead of throwing (webhooks, tracking).
 * - `silent`: no customer email / WhatsApp for this change (e.g. an abandoned order replaced by a new checkout).
 * Illegal moves (see ALLOWED_FROM) throw IllegalStatusChangeError for people, or return false for
 * automated actors.
 */
export async function setOrderStatus(
  orderId: number,
  to: OrderStatus,
  actor: Actor,
  note?: string,
  opts: { onlyFrom?: readonly OrderStatus[]; restock?: boolean; quiet?: boolean; silent?: boolean } = {},
): Promise<boolean> {
  let changed = false;
  await inTx(async (conn) => {
    const [r] = await conn.execute<Row[]>(
      "SELECT status FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    const from = r[0]?.status as string | undefined;
    if (!from || from === to) return;
    if (opts.onlyFrom && !opts.onlyFrom.includes(from as OrderStatus)) return;
    if (!ALLOWED_FROM[to]?.includes(from as OrderStatus)) {
      if (opts.quiet || QUIET_ACTORS.includes(actor)) {
        await logEvent(conn, orderId, from, from, actor, `Ignored status update to "${to}" (not allowed from "${from}")${note ? `: ${note}` : ""}`);
        return;
      }
      throw new IllegalStatusChangeError(`An order that is "${from.replace(/_/g, " ")}" can't be moved to "${to.replace(/_/g, " ")}".`);
    }
    // Never cancel an order that has a live courier shipment (checked under the same lock as booking):
    // the parcel would still go out. Cancel the shipment first.
    if (to === "cancelled") {
      const [live] = await conn.execute<Row[]>(
        "SELECT awb FROM shipments WHERE order_id = ? AND status <> 'cancelled' LIMIT 1 FOR UPDATE",
        [orderId],
      );
      if (live.length) {
        if (opts.quiet || QUIET_ACTORS.includes(actor)) {
          await logEvent(conn, orderId, from, from, actor, `Ignored cancel: a courier shipment exists${note ? ` (${note})` : ""}`);
          return;
        }
        throw new IllegalStatusChangeError("This order has a courier shipment. Cancel the shipment first, then cancel the order.");
      }
    }
    await conn.execute(
      // Compare in JS, not "? = 'cancelled'": on live MariaDB a bound value and a literal carry
      // different collations and the comparison fails ("Illegal mix of collations").
      `UPDATE orders SET status = ?, cancelled_at = IF(?, NOW(), cancelled_at) WHERE id = ?`,
      [to, to === "cancelled" ? 1 : 0, orderId],
    );
    await logEvent(conn, orderId, from, to, actor, note);
    changed = true;
    // Cancelled before delivery: whatever this order holds or took goes back (once).
    if (to === "cancelled" || opts.restock)
      await returnStock(conn, orderId, "any", "restock", actor);
    // A cancelled order gives its coupon use back (per-phone / first-order / total limits).
    if (to === "cancelled") await releaseCouponForOrder(conn, orderId);
  });
  // Customer emails go out after the change is committed.
  if (changed && (to === "paid" || to === "shipped" || to === "delivered"))
    await ensureInvoiceIfApplicable(orderId).catch((error) => console.error("Invoice could not be created", orderId, error));
  if (to === "cancelled" || to === "rto" || to === "refunded" || to === "partially_refunded")
    await ensureCreditNotesForOrder(orderId).catch((error) => console.error("Credit note could not be created", orderId, error));
  if (changed && !opts.silent && (to === "delivered" || to === "cancelled"))
    await notifyOrder(orderId, to);
  if (changed && !opts.silent && (to === "delivered" || to === "cancelled"))
    await queueOrderWhatsApp(orderId, to).catch((error) => console.error("WhatsApp status notification", error));
  return changed;
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

/** True once a (not cancelled) courier shipment exists: after this the shopper can no longer self-cancel. */
export async function hasActiveShipment(orderId: number): Promise<boolean> {
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT 1 FROM shipments WHERE order_id=? AND status<>'cancelled' LIMIT 1",
    [orderId],
  );
  return rows.length > 0;
}
