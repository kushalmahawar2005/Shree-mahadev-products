import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { PLACED } from "@/lib/server/dashboard";
import { db } from "@/lib/server/db";

type Rows = RowDataPacket[];
export const CUSTOMER_LTV_THRESHOLD = 5000;
export const CUSTOMERS_PER_PAGE = 25;
export const CUSTOMER_FILTERS = [
  "all",
  "repeat",
  "one_time",
  "high_value",
  "inactive_90d",
  "cod_only",
  "rto",
] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];

export type CustomerListOptions = {
  q?: string;
  filter?: CustomerFilter;
  page?: number;
};

const statsJoin = `LEFT JOIN (
  SELECT customer_id,
    SUM(status IN (?)) AS placed_orders,
    SUM(CASE WHEN status IN (?) THEN total ELSE 0 END) AS lifetime_value,
    MAX(CASE WHEN status IN (?) THEN created_at ELSE NULL END) AS last_order_at,
    SUM(status IN (?) AND payment_method <> 'cod') AS non_cod_orders,
    SUM(status = 'rto') AS rto_count
  FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id
) o ON o.customer_id = c.id`;

function whereFor({ q = "", filter = "all" }: CustomerListOptions) {
  const where: string[] = [];
  const params: unknown[] = [PLACED, PLACED, PLACED, PLACED];
  if (q) {
    where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)");
    const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    params.push(term, term, term);
  }
  switch (filter) {
    case "repeat":
      where.push("COALESCE(o.placed_orders,0) >= 2");
      break;
    case "one_time":
      where.push("COALESCE(o.placed_orders,0) = 1");
      break;
    case "high_value":
      where.push(`COALESCE(o.lifetime_value,0) >= ${CUSTOMER_LTV_THRESHOLD}`);
      break;
    case "inactive_90d":
      where.push(
        "(o.last_order_at IS NULL OR o.last_order_at < NOW() - INTERVAL 90 DAY)",
      );
      break;
    case "cod_only":
      where.push(
        "COALESCE(o.placed_orders,0) > 0 AND COALESCE(o.non_cod_orders,0) = 0",
      );
      break;
    case "rto":
      where.push("COALESCE(o.rto_count,0) > 0");
      break;
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listCustomers({
  q = "",
  filter = "all",
  page = 1,
}: CustomerListOptions) {
  const currentPage = Math.max(1, Math.floor(page));
  const { sql, params } = whereFor({ q, filter });
  const conn = db();
  const [[count]] = await conn.query<Rows>(
    `SELECT COUNT(*) AS total FROM customers c ${statsJoin} ${sql}`,
    params,
  );
  const [rows] = await conn.query<Rows>(
    `SELECT c.id, c.name, c.phone, c.email, c.created_at,
       COALESCE(a.city, '') AS city, COALESCE(a.state, '') AS state,
       COALESCE(o.placed_orders,0) AS orders_count, COALESCE(o.lifetime_value,0) AS lifetime_value,
       o.last_order_at, COALESCE(o.placed_orders,0) > 0 AND COALESCE(o.non_cod_orders,0) = 0 AS cod_only,
       COALESCE(o.rto_count,0) AS rto_count
     FROM customers c
     LEFT JOIN (SELECT customer_id, SUBSTRING_INDEX(GROUP_CONCAT(city ORDER BY created_at DESC, id DESC), ',', 1) city,
       SUBSTRING_INDEX(GROUP_CONCAT(state ORDER BY created_at DESC, id DESC), ',', 1) state
       FROM addresses GROUP BY customer_id) a ON a.customer_id = c.id
     ${statsJoin} ${sql}
     ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    [...params, CUSTOMERS_PER_PAGE, (currentPage - 1) * CUSTOMERS_PER_PAGE],
  );
  return {
    total: Number(count.total),
    page: currentPage,
    perPage: CUSTOMERS_PER_PAGE,
    customers: rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      phone: String(r.phone),
      email: String(r.email ?? ""),
      city: String(r.city),
      state: String(r.state),
      orders: Number(r.orders_count),
      ltv: Number(r.lifetime_value),
      lastOrder: r.last_order_at as string | null,
      codOnly: Boolean(r.cod_only),
      rtoCount: Number(r.rto_count),
    })),
  };
}

export async function exportCustomers({
  q = "",
  filter = "all",
}: CustomerListOptions) {
  const { sql, params } = whereFor({ q, filter });
  const [rows] = await db().query<Rows>(
    `SELECT c.name, c.phone, c.email, COALESCE(a.city,'') AS city, COALESCE(a.state,'') AS state,
       COALESCE(o.placed_orders,0) AS orders_count, COALESCE(o.lifetime_value,0) AS lifetime_value, o.last_order_at
     FROM customers c
     LEFT JOIN (SELECT customer_id, SUBSTRING_INDEX(GROUP_CONCAT(city ORDER BY created_at DESC, id DESC), ',', 1) city,
       SUBSTRING_INDEX(GROUP_CONCAT(state ORDER BY created_at DESC, id DESC), ',', 1) state
       FROM addresses GROUP BY customer_id) a ON a.customer_id = c.id
     ${statsJoin} ${sql} ORDER BY c.id DESC`,
    params,
  );
  return rows.map((r) => [
    r.name,
    r.phone,
    r.email ?? "",
    r.city,
    r.state,
    r.orders_count,
    r.lifetime_value,
    r.last_order_at ?? "",
  ]);
}

export async function getCustomerById(id: number) {
  const [[row]] = await db().query<Rows>(
    `SELECT c.id, c.name, c.phone, c.email, c.notes, c.tags, c.created_at,
       COALESCE(SUM(CASE WHEN o.status IN (?) THEN o.total ELSE 0 END),0) AS lifetime_value,
       SUM(o.status IN (?)) AS orders_count, SUM(o.status='rto') AS rto_count,
       MAX(CASE WHEN o.status IN (?) THEN o.created_at ELSE NULL END) AS last_order_at
     FROM customers c LEFT JOIN orders o ON o.customer_id=c.id WHERE c.id=? GROUP BY c.id`,
    [PLACED, PLACED, PLACED, id],
  );
  if (!row) return null;
  const tagsRaw = row.tags;
  let tags: string[] = [];
  try {
    const parsed = typeof tagsRaw === "string" ? JSON.parse(tagsRaw) : tagsRaw;
    if (Array.isArray(parsed))
      tags = parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    /* Invalid legacy tags are treated as empty. */
  }

  const [addresses] = await db().query<Rows>(
    "SELECT name, phone, line1, line2, city, state, pincode, created_at FROM addresses WHERE customer_id=? ORDER BY created_at DESC, id DESC",
    [id],
  );
  const [orders] = await db().query<Rows>(
    `SELECT id, order_no, status, payment_method, total, created_at FROM orders
     WHERE customer_id=? ORDER BY created_at DESC, id DESC`,
    [id],
  );
  return {
    id: Number(row.id),
    name: String(row.name),
    phone: String(row.phone),
    email: String(row.email ?? ""),
    notes: String(row.notes ?? ""),
    tags,
    createdAt: row.created_at as string,
    ltv: Number(row.lifetime_value),
    orderCount: Number(row.orders_count),
    rtoCount: Number(row.rto_count),
    lastOrder: row.last_order_at as string | null,
    addresses: addresses.map((a) => ({
      name: String(a.name),
      phone: String(a.phone),
      line1: String(a.line1),
      line2: String(a.line2 ?? ""),
      city: String(a.city),
      state: String(a.state),
      pincode: String(a.pincode),
      createdAt: a.created_at as string,
    })),
    orders: orders.map((o) => ({
      id: Number(o.id),
      orderNo: String(o.order_no ?? `#${o.id}`),
      status: String(o.status),
      paymentMethod: String(o.payment_method),
      total: Number(o.total),
      createdAt: o.created_at as string,
    })),
  };
}

/** Store-wide numbers for the customers list header. */
export async function customerStats() {
  const [[r]] = await db().query<Rows>(
    `SELECT COUNT(*) AS total,
       SUM(COALESCE(o.placed_orders,0) >= 1) AS buyers,
       SUM(COALESCE(o.placed_orders,0) >= 2) AS repeat_buyers,
       COALESCE(SUM(o.lifetime_value),0) AS revenue,
       SUM(c.created_at > NOW() - INTERVAL 30 DAY) AS new_30d
     FROM customers c ${statsJoin}`,
    [PLACED, PLACED, PLACED, PLACED],
  );
  return {
    total: Number(r.total),
    buyers: Number(r.buyers ?? 0),
    repeat: Number(r.repeat_buyers ?? 0),
    revenue: Number(r.revenue),
    new30d: Number(r.new_30d ?? 0),
  };
}
