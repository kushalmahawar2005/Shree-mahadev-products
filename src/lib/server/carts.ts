import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { Cart } from "@/lib/commerce/types";
import { db } from "./db";

/** Minutes of inactivity after which an unconverted cart counts as abandoned. */
export const ABANDON_AFTER_MIN = 30;

/** Mirror the shopper's cart into MySQL (one row per smp_cid cookie). */
export async function syncCart(token: string, cart: Cart) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO carts (token, item_count, subtotal) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE item_count = VALUES(item_count), subtotal = VALUES(subtotal),
         last_activity_at = CURRENT_TIMESTAMP, id = LAST_INSERT_ID(id)`,
      [token, cart.totalQuantity, cart.subtotal.amount],
    );
    const [[row]] = await conn.query<RowDataPacket[]>("SELECT LAST_INSERT_ID() AS id");
    const id = row.id as number;
    await conn.execute("DELETE FROM cart_items WHERE cart_id = ?", [id]);
    for (const l of cart.lines) {
      await conn.execute(
        `INSERT INTO cart_items (cart_id, variant_key, product_handle, product_title, variant_title, unit_price, quantity)
         VALUES (?,?,?,?,?,?,?)`,
        [id, l.variant.id, l.product.handle, l.product.title, l.variant.title, l.variant.price.amount, l.quantity],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Contact details typed on the checkout page, saved before the order is placed. */
export async function captureCartContact(
  token: string,
  c: { name?: string; phone?: string; email?: string; pincode?: string },
) {
  await db().execute(
    `UPDATE carts SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email),
       pincode = COALESCE(?, pincode), reached_checkout = 1, last_activity_at = CURRENT_TIMESTAMP
     WHERE token = ? AND status = 'active'`,
    [c.name || null, c.phone || null, c.email || null, c.pincode || null, token],
  );
}

export async function getCartIdByToken(token: string): Promise<number | null> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT id FROM carts WHERE token = ? AND status = 'active'", [token]);
  return (rows[0]?.id as number) ?? null;
}

export async function getRecoverableItems(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT ci.variant_key, ci.quantity FROM carts c JOIN cart_items ci ON ci.cart_id = c.id
     WHERE c.token = ? AND c.status = 'active'`,
    [token],
  );
  if (!rows.length) return null;
  await db().execute("UPDATE carts SET recovered_at = COALESCE(recovered_at, NOW()) WHERE token = ?", [token]);
  return rows.map((r) => ({ variantKey: r.variant_key as string, quantity: r.quantity as number }));
}

export type AdminCart = {
  id: number;
  token: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  pincode: string | null;
  itemCount: number;
  subtotal: number;
  reachedCheckout: boolean;
  status: "abandoned" | "recovered" | "converted";
  orderNo: string | null;
  orderStatus: string | null;
  reminderCount: number;
  reminderSentAt: string | null;
  linkOpenedAt: string | null;
  lastActivityAt: string;
  items: { title: string; variant: string; qty: number; price: number }[];
};

/**
 * Admin view, last 30 days:
 *  - abandoned: active, has items, idle > ABANDON_AFTER_MIN
 *  - recovered: converted after we sent a reminder
 *  - converted: other completed carts (only counted in stats)
 */
export async function listAdminCarts(): Promise<AdminCart[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT c.*, o.order_no, o.status AS order_status FROM carts c
     LEFT JOIN orders o ON o.id = c.order_id
     WHERE c.item_count > 0 AND c.created_at > NOW() - INTERVAL 30 DAY
       AND (c.status = 'converted' OR c.last_activity_at < NOW() - INTERVAL ? MINUTE)
     ORDER BY c.last_activity_at DESC LIMIT 300`,
    [ABANDON_AFTER_MIN],
  );
  if (!rows.length) return [];
  const [items] = await db().query<RowDataPacket[]>(
    "SELECT cart_id, product_title, variant_title, quantity, unit_price FROM cart_items WHERE cart_id IN (?)",
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    name: r.name,
    phone: r.phone,
    email: r.email,
    pincode: r.pincode,
    itemCount: r.item_count,
    subtotal: r.subtotal,
    reachedCheckout: !!r.reached_checkout,
    status: r.status === "converted" ? (r.reminder_count > 0 ? "recovered" : "converted") : "abandoned",
    orderNo: r.order_no,
    orderStatus: r.order_status,
    reminderCount: r.reminder_count,
    reminderSentAt: r.reminder_sent_at,
    linkOpenedAt: r.recovered_at,
    lastActivityAt: r.last_activity_at,
    items: items
      .filter((i) => i.cart_id === r.id)
      .map((i) => ({ title: i.product_title, variant: i.variant_title, qty: i.quantity, price: i.unit_price })),
  }));
}

export async function markReminderSent(cartId: number) {
  const [res] = await db().execute<ResultSetHeader>(
    "UPDATE carts SET reminder_count = reminder_count + 1, reminder_sent_at = NOW() WHERE id = ? AND status = 'active'",
    [cartId],
  );
  return res.affectedRows > 0;
}
