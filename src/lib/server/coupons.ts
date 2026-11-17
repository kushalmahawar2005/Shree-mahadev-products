import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";

export type CouponKind = "percent" | "flat" | "free_shipping";
export type CouponTarget = { kind: "product" | "collection"; handle: string };
export type CouponLine = {
  productHandle: string;
  unitPrice: number;
  quantity: number;
};
export type CouponQuote = {
  code: string;
  discount: number;
  freeShipping: boolean;
  /** True when first-order / per-phone rules exist and were not checked (preview without a phone). */
  phoneRulesPending?: boolean;
};

export class CouponError extends Error {}
type CouponRow = RowDataPacket & {
  id: number;
  code: string;
  kind: CouponKind;
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  first_order_only: number;
  usage_limit: number | null;
  per_phone_limit: number | null;
  used_count: number;
};

const fail = (message: string): never => {
  throw new CouponError(message);
};

/** Revalidates and calculates against server-priced lines. `conn` locks the
 * coupon row when called during order creation, preventing concurrent overspend. */
export async function calculateCoupon(
  code: string,
  subtotal: number,
  phone: string,
  lines: CouponLine[],
  conn?: PoolConnection,
): Promise<CouponQuote> {
  const executor = conn ?? db();
  const [rows] = await executor.execute<CouponRow[]>(
    `SELECT id, code, kind, value, min_subtotal, max_discount, first_order_only,
       usage_limit, per_phone_limit, used_count FROM coupons
     WHERE code=? AND active=1 AND (starts_at IS NULL OR starts_at<=NOW())
       AND (ends_at IS NULL OR ends_at>=NOW()) ${conn ? "FOR UPDATE" : ""}`,
    [code.trim().toUpperCase()],
  );
  const coupon = rows[0];
  if (!coupon) fail("This coupon code is invalid or has expired.");
  if (subtotal < Number(coupon.min_subtotal))
    fail(`This code needs a ₹${Number(coupon.min_subtotal)} minimum order.`);
  if (
    coupon.usage_limit !== null &&
    Number(coupon.used_count) >= Number(coupon.usage_limit)
  )
    fail("This coupon has reached its usage limit.");
  // Cart preview passes no phone: phone-based rules are checked at checkout (order creation always has one).
  if (coupon.first_order_only && phone) {
    const [orders] = await executor.execute<RowDataPacket[]>(
      // pending_payment counts too: otherwise one phone could open several "first order" PayU orders.
      `SELECT COUNT(*) AS n FROM orders WHERE phone=? AND status IN
       ('pending_payment','paid','cod_pending','confirmed','packed','shipped','delivered','partially_refunded')`,
      [phone],
    );
    if (Number(orders[0]?.n) > 0) fail("This code is for first orders only.");
  }
  if (coupon.per_phone_limit !== null && phone) {
    const [uses] = await executor.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id=? AND phone=?",
      [coupon.id, phone],
    );
    if (Number(uses[0]?.n) >= Number(coupon.per_phone_limit))
      fail("You have already used this code the maximum number of times.");
  }

  const [targets] = await executor.execute<RowDataPacket[]>(
    "SELECT kind, handle FROM coupon_targets WHERE coupon_id=?",
    [coupon.id],
  );
  let eligible = subtotal;
  if (targets.length) {
    const productHandles = targets
      .filter((t) => t.kind === "product")
      .map((t) => String(t.handle));
    const collectionHandles = targets
      .filter((t) => t.kind === "collection")
      .map((t) => String(t.handle));
    const [members] = collectionHandles.length
      ? await executor.query<RowDataPacket[]>(
          "SELECT p.handle FROM products p JOIN collection_products cp ON cp.product_id=p.id JOIN collections c ON c.id=cp.collection_id WHERE c.handle IN (?)",
          [collectionHandles],
        )
      : [[] as RowDataPacket[]];
    const allowed = new Set([
      ...productHandles,
      ...members.map((r) => String(r.handle)),
    ]);
    eligible = lines.reduce(
      (sum, line) =>
        sum +
        (allowed.has(line.productHandle) ? line.unitPrice * line.quantity : 0),
      0,
    );
    if (!eligible)
      fail("This code doesn't apply to the products in your order.");
  }
  const raw =
    coupon.kind === "percent"
      ? Math.floor((eligible * Number(coupon.value)) / 100)
      : coupon.kind === "flat"
        ? Math.min(Number(coupon.value), eligible)
        : 0;
  const discount =
    coupon.kind === "free_shipping"
      ? 0
      : Math.min(
          eligible,
          coupon.max_discount === null
            ? raw
            : Math.min(raw, Number(coupon.max_discount)),
        );
  return {
    code: coupon.code,
    discount,
    freeShipping: coupon.kind === "free_shipping",
    phoneRulesPending: !phone && (!!coupon.first_order_only || coupon.per_phone_limit !== null),
  };
}

export async function listCoupons() {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT c.id, c.code, c.kind, c.value, c.min_subtotal, c.max_discount,
       c.first_order_only, c.usage_limit, c.per_phone_limit, c.used_count,
       c.starts_at, c.ends_at, c.active,
       COUNT(DISTINCT r.order_id) AS redeemed, COALESCE(SUM(o.total),0) AS revenue
     FROM coupons c LEFT JOIN coupon_redemptions r ON r.coupon_id=c.id
     LEFT JOIN orders o ON o.id=r.order_id
     GROUP BY c.id ORDER BY c.created_at DESC`,
  );
  const [targets] = rows.length
    ? await db().query<RowDataPacket[]>(
        "SELECT coupon_id, kind, handle FROM coupon_targets WHERE coupon_id IN (?)",
        [rows.map((r) => Number(r.id))],
      )
    : [[] as RowDataPacket[]];
  const byId = new Map<number, CouponTarget[]>();
  for (const row of targets) {
    const id = Number(row.coupon_id);
    const list = byId.get(id) ?? [];
    list.push({
      kind: row.kind as CouponTarget["kind"],
      handle: String(row.handle),
    });
    byId.set(id, list);
  }
  return rows.map((row) => ({
    id: Number(row.id),
    code: String(row.code),
    kind: row.kind as CouponKind,
    value: Number(row.value),
    minSubtotal: Number(row.min_subtotal),
    maxDiscount: row.max_discount === null ? null : Number(row.max_discount),
    firstOrderOnly: Boolean(row.first_order_only),
    usageLimit: row.usage_limit === null ? null : Number(row.usage_limit),
    perPhoneLimit:
      row.per_phone_limit === null ? null : Number(row.per_phone_limit),
    usedCount: Number(row.used_count),
    redeemed: Number(row.redeemed),
    revenue: Number(row.revenue),
    startsAt: row.starts_at ? String(row.starts_at).slice(0, 16) : "",
    endsAt: row.ends_at ? String(row.ends_at).slice(0, 16) : "",
    active: Boolean(row.active),
    targets: byId.get(Number(row.id)) ?? [],
  }));
}

/**
 * Give back the coupon use(s) reserved by an order (order cancelled, or its payment failed / expired)
 * and recount `used_count`. Safe to call twice. Run inside the caller's transaction.
 */
export async function releaseCouponForOrder(conn: PoolConnection, orderId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>("SELECT DISTINCT coupon_id FROM coupon_redemptions WHERE order_id=?", [orderId]);
  if (!rows.length) return;
  await conn.execute("DELETE FROM coupon_redemptions WHERE order_id=?", [orderId]);
  for (const r of rows)
    await conn.execute("UPDATE coupons SET used_count=(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=?) WHERE id=?", [r.coupon_id, r.coupon_id]);
}

export class CouponUnavailableError extends Error {}

/**
 * Before retrying payment on an order whose coupon use was released (payment failed / hold expired):
 * take the use again under the coupon lock, re-checking it is still active, in date and within its
 * total and per-phone limits. Throws CouponUnavailableError if not (the order total includes that
 * discount, so the shopper must check out again). No-op if the order still holds its use.
 */
export async function reserveCouponForRetry(conn: PoolConnection, orderId: number) {
  const [[o]] = await conn.execute<RowDataPacket[]>("SELECT coupon_code, discount, phone FROM orders WHERE id=? FOR UPDATE", [orderId]);
  if (!o?.coupon_code) return;
  const [held] = await conn.execute<RowDataPacket[]>("SELECT 1 FROM coupon_redemptions WHERE order_id=? LIMIT 1", [orderId]);
  if (held.length) return;
  const [[c]] = await conn.execute<RowDataPacket[]>(
    `SELECT id, usage_limit, per_phone_limit FROM coupons
      WHERE code=? AND active=1 AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) FOR UPDATE`,
    [o.coupon_code],
  );
  const unavailable = () => {
    throw new CouponUnavailableError(`The coupon ${o.coupon_code} on this order is no longer available.`);
  };
  if (!c) unavailable();
  const [[total]] = await conn.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id=?", [c.id]);
  if (c.usage_limit !== null && Number(total.n) >= Number(c.usage_limit)) unavailable();
  if (c.per_phone_limit !== null) {
    const [[mine]] = await conn.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id=? AND phone=?", [c.id, o.phone]);
    if (Number(mine.n) >= Number(c.per_phone_limit)) unavailable();
  }
  await conn.execute("INSERT INTO coupon_redemptions (coupon_id, order_id, phone, amount) VALUES (?,?,?,?)", [c.id, orderId, o.phone, o.discount]);
  await conn.execute("UPDATE coupons SET used_count=(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=?) WHERE id=?", [c.id, c.id]);
}
