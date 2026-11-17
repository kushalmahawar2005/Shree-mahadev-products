import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { releaseCouponForOrder } from "./coupons";

/** How long a PayU order holds stock while the customer pays. */
export const HOLD_MINUTES = 30;

type Rows = RowDataPacket[];
type Conn = PoolConnection;

export class OutOfStockError extends Error {
  constructor(public readonly items: { title: string; available: number }[]) {
    super(
      items
        .map((i) => (i.available > 0 ? `Only ${i.available} left of ${i.title}.` : `${i.title} just went out of stock.`))
        .join(" ") + " Please update your cart.",
    );
  }
}

async function log(c: Conn, variantKey: string, delta: number, reason: string, actor: string, orderId: number | null, note?: string) {
  const [[row]] = await c.query<Rows>("SELECT stock_qty FROM product_variants WHERE variant_key = ?", [variantKey]);
  await c.execute(
    "INSERT INTO inventory_log (variant_key, delta, stock_after, reason, order_id, note, actor) VALUES (?,?,?,?,?,?,?)",
    [variantKey, delta, row?.stock_qty ?? null, reason, orderId, note?.slice(0, 255) ?? null, actor],
  );
}

/**
 * Take stock for an order's lines inside the caller's transaction.
 * Rows are locked (FOR UPDATE) in a fixed order so two checkouts for the last unit can't both win.
 * Untracked variants (stock_qty NULL) are skipped.
 */
export async function takeStock(
  c: Conn,
  orderId: number,
  lines: { variantKey: string; title: string; quantity: number }[],
  mode: "hold" | "commit",
) {
  const keys = [...new Set(lines.map((l) => l.variantKey))].sort();
  if (!keys.length) return;
  const [rows] = await c.query<Rows>(
    "SELECT variant_key, stock_qty FROM product_variants WHERE variant_key IN (?) ORDER BY variant_key FOR UPDATE",
    [keys],
  );
  const stock = new Map(rows.map((r) => [r.variant_key as string, r.stock_qty as number | null]));
  // Check the total per variant: the same variant on two lines must not pass two separate checks.
  const wanted = new Map<string, number>();
  for (const l of lines) wanted.set(l.variantKey, (wanted.get(l.variantKey) ?? 0) + l.quantity);
  const short = lines
    .filter((l, i) => lines.findIndex((x) => x.variantKey === l.variantKey) === i)
    .filter((l) => {
      const s = stock.get(l.variantKey);
      return s !== null && s !== undefined && s < (wanted.get(l.variantKey) ?? 0);
    })
    .map((l) => ({ title: l.title, available: Math.max(0, stock.get(l.variantKey) ?? 0) }));
  if (short.length) throw new OutOfStockError(short);

  for (const l of lines) {
    if (stock.get(l.variantKey) === null || stock.get(l.variantKey) === undefined) continue;
    await c.execute("UPDATE product_variants SET stock_qty = stock_qty - ? WHERE variant_key = ?", [l.quantity, l.variantKey]);
    await c.execute(
      `INSERT INTO stock_reservations (order_id, variant_key, quantity, status, expires_at)
       VALUES (?, ?, ?, ?, ${mode === "hold" ? `NOW() + INTERVAL ${HOLD_MINUTES} MINUTE` : "NULL"})`,
      [orderId, l.variantKey, l.quantity, mode === "hold" ? "held" : "committed"],
    );
    await log(c, l.variantKey, -l.quantity, "order", "system", orderId, mode === "hold" ? "Held for online payment" : undefined);
  }
}

/** Return stock for an order. `from` decides which reservations; each row is returned once (idempotent). */
export async function returnStock(
  c: Conn,
  orderId: number,
  from: "held" | "committed" | "any",
  reason: "release" | "restock" | "rto_return",
  actor: string,
) {
  const statuses = from === "any" ? ["held", "committed"] : [from];
  const [rows] = await c.query<Rows>(
    "SELECT id, variant_key, quantity, status FROM stock_reservations WHERE order_id = ? AND status IN (?) FOR UPDATE",
    [orderId, statuses],
  );
  for (const r of rows) {
    await c.execute("UPDATE product_variants SET stock_qty = stock_qty + ? WHERE variant_key = ? AND stock_qty IS NOT NULL", [
      r.quantity,
      r.variant_key,
    ]);
    await c.execute("UPDATE stock_reservations SET status = ? WHERE id = ?", [r.status === "held" ? "released" : "restocked", r.id]);
    await log(c, r.variant_key, r.quantity, reason, actor, orderId);
  }
  return rows.length;
}

/** PayU paid: held → committed. If the hold had already expired, take the stock again (logged as oversold if short). */
export async function commitStock(c: Conn, orderId: number) {
  await c.execute("UPDATE stock_reservations SET status = 'committed', expires_at = NULL WHERE order_id = ? AND status = 'held'", [orderId]);
  const [released] = await c.query<Rows>(
    "SELECT id, variant_key, quantity FROM stock_reservations WHERE order_id = ? AND status = 'released' FOR UPDATE",
    [orderId],
  );
  let oversold = false;
  for (const r of released) {
    const [[v]] = await c.query<Rows>("SELECT stock_qty FROM product_variants WHERE variant_key = ? FOR UPDATE", [r.variant_key]);
    if (v && v.stock_qty !== null && v.stock_qty < r.quantity) oversold = true;
    await c.execute("UPDATE product_variants SET stock_qty = stock_qty - ? WHERE variant_key = ? AND stock_qty IS NOT NULL", [
      r.quantity,
      r.variant_key,
    ]);
    await c.execute("UPDATE stock_reservations SET status = 'committed', expires_at = NULL WHERE id = ?", [r.id]);
    await log(c, r.variant_key, -r.quantity, "order", "system", orderId, "Paid after the hold expired");
  }
  return { oversold };
}

/** Re-hold stock when a customer retries payment on a failed/expired order. */
export async function reholdStock(c: Conn, orderId: number, titles: Map<string, string>) {
  const [released] = await c.query<Rows>(
    "SELECT id, variant_key, quantity FROM stock_reservations WHERE order_id = ? AND status = 'released'",
    [orderId],
  );
  if (!released.length) {
    await c.execute(
      `UPDATE stock_reservations SET expires_at = NOW() + INTERVAL ${HOLD_MINUTES} MINUTE WHERE order_id = ? AND status = 'held'`,
      [orderId],
    );
    return;
  }
  const keys = [...new Set(released.map((r) => r.variant_key as string))].sort();
  const [rows] = await c.query<Rows>(
    "SELECT variant_key, stock_qty FROM product_variants WHERE variant_key IN (?) ORDER BY variant_key FOR UPDATE",
    [keys],
  );
  const stock = new Map(rows.map((r) => [r.variant_key as string, r.stock_qty as number | null]));
  const short = released
    .filter((r) => stock.get(r.variant_key) !== null && (stock.get(r.variant_key) ?? 0) < r.quantity)
    .map((r) => ({ title: titles.get(r.variant_key) ?? r.variant_key, available: Math.max(0, stock.get(r.variant_key) ?? 0) }));
  if (short.length) throw new OutOfStockError(short);
  for (const r of released) {
    await c.execute("UPDATE product_variants SET stock_qty = stock_qty - ? WHERE variant_key = ? AND stock_qty IS NOT NULL", [
      r.quantity,
      r.variant_key,
    ]);
    await c.execute(
      `UPDATE stock_reservations SET status = 'held', expires_at = NOW() + INTERVAL ${HOLD_MINUTES} MINUTE WHERE id = ?`,
      [r.id],
    );
    await log(c, r.variant_key, -r.quantity, "order", "customer", orderId, "Held again for payment retry");
  }
}

/**
 * Release holds older than HOLD_MINUTES and mark those orders payment_failed.
 * Called lazily (before taking stock, on admin pages) and later from a cron route.
 */
export async function releaseExpiredHolds(): Promise<number> {
  const [orders] = await db().query<Rows>(
    "SELECT DISTINCT order_id FROM stock_reservations WHERE status = 'held' AND expires_at < NOW() LIMIT 100",
  );
  for (const { order_id } of orders) {
    const c = await db().getConnection();
    try {
      await c.beginTransaction();
      const [[o]] = await c.query<Rows>("SELECT status FROM orders WHERE id = ? FOR UPDATE", [order_id]);
      if (o?.status === "pending_payment" || o?.status === "payment_failed") {
        await returnStock(c, order_id, "held", "release", "system");
        if (o.status === "pending_payment") {
          await c.execute("UPDATE orders SET status = 'payment_failed' WHERE id = ?", [order_id]);
          await releaseCouponForOrder(c, order_id);
          await c.execute(
            "INSERT INTO order_events (order_id, from_status, to_status, actor, note) VALUES (?, 'pending_payment', 'payment_failed', 'system', ?)",
            [order_id, `Payment not completed within ${HOLD_MINUTES} minutes; stock released`],
          );
        }
      } else {
        // Paid or otherwise moved on: just stop holding.
        await c.execute("UPDATE stock_reservations SET expires_at = NULL WHERE order_id = ? AND status = 'held'", [order_id]);
      }
      await c.commit();
    } catch (e) {
      await c.rollback();
      console.error("releaseExpiredHolds", order_id, e);
    } finally {
      c.release();
    }
  }
  return orders.length;
}

// ───────────── Admin inventory ─────────────

export type InventoryRow = {
  variantKey: string;
  handle: string;
  productTitle: string;
  productStatus: string;
  size: string;
  sku: string | null;
  stock: number | null;
  enabled: boolean;
  price: number;
  held: number;
  waiting: number; // back-in-stock requests not yet notified
  swatch: string | null;
  image: string | null; // first product photo, if any
};

export async function listInventory(): Promise<InventoryRow[]> {
  const [rows] = await db().query<Rows>(
    `SELECT v.variant_key, v.title, v.sku, v.stock_qty, v.available, v.price, p.handle, p.title AS product_title, p.status, p.swatch,
       (SELECT i.url FROM product_images i WHERE i.product_handle = p.handle ORDER BY i.sort_order, i.id LIMIT 1) AS image,
       (SELECT COALESCE(SUM(quantity),0) FROM stock_reservations r WHERE r.variant_key = v.variant_key AND r.status = 'held') AS held,
       (SELECT COUNT(*) FROM back_in_stock b WHERE b.variant_key = v.variant_key AND b.notified_at IS NULL) AS waiting
     FROM product_variants v JOIN products p ON p.id = v.product_id
     ORDER BY p.sort_order, p.id, v.sort_order`,
  );
  return rows.map((r) => ({
    variantKey: r.variant_key,
    handle: r.handle,
    productTitle: r.product_title,
    productStatus: r.status,
    size: r.title,
    sku: r.sku,
    stock: r.stock_qty === null ? null : Number(r.stock_qty),
    enabled: !!r.available,
    price: Number(r.price),
    held: Number(r.held),
    waiting: Number(r.waiting),
    swatch: (r.swatch as string | null) ?? null,
    image: (r.image as string | null) ?? null,
  }));
}

export type AdjustReason = "restock_manual" | "damaged" | "correction";

/** Admin +/- (or set exact for corrections). Logged with reason. Returns the new stock. */
export async function adjustStock(variantKey: string, input: { mode: "delta" | "set" | "untrack"; value: number; reason: AdjustReason; note?: string }) {
  const c = await db().getConnection();
  try {
    await c.beginTransaction();
    const [[v]] = await c.query<Rows>("SELECT stock_qty FROM product_variants WHERE variant_key = ? FOR UPDATE", [variantKey]);
    if (!v) throw new Error("Size not found");
    const before = v.stock_qty === null ? null : Number(v.stock_qty);
    let after: number | null;
    if (input.mode === "untrack") after = null;
    else if (input.mode === "set") after = input.value;
    else after = (before ?? 0) + input.value;
    if (after !== null && after < 0) throw new Error("Stock can't go below 0");
    await c.execute<ResultSetHeader>("UPDATE product_variants SET stock_qty = ? WHERE variant_key = ?", [after, variantKey]);
    await log(c, variantKey, (after ?? 0) - (before ?? 0), input.reason, "admin", null, input.mode === "untrack" ? "Stopped tracking stock" : input.note);
    await c.commit();
    return after;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function inventoryLog(variantKey: string, limit = 20) {
  const [rows] = await db().query<Rows>(
    "SELECT delta, stock_after, reason, order_id, note, actor, created_at FROM inventory_log WHERE variant_key = ? ORDER BY id DESC LIMIT ?",
    [variantKey, limit],
  );
  return rows.map((r) => ({
    delta: Number(r.delta),
    stockAfter: r.stock_after === null ? null : Number(r.stock_after),
    reason: r.reason as string,
    orderId: r.order_id as number | null,
    note: r.note as string | null,
    actor: r.actor as string,
    at: r.created_at as string,
  }));
}

export async function addBackInStockRequest(variantKey: string, phone: string) {
  await db().execute("INSERT IGNORE INTO back_in_stock (variant_key, phone) VALUES (?, ?)", [variantKey, phone]);
}

const gl = globalThis as unknown as { __lastHoldSweep?: number };

/** Cheap, throttled sweep (once a minute per server process) for hot paths like the cart. */
export async function sweepExpiredHolds() {
  const now = Date.now();
  if (gl.__lastHoldSweep && now - gl.__lastHoldSweep < 60_000) return;
  gl.__lastHoldSweep = now;
  await releaseExpiredHolds().catch((e) => console.error("sweepExpiredHolds", e));
}
