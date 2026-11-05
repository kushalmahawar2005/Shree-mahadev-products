import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { PLACED, type Range } from "./dashboard";
import { db } from "./db";

type Rows = RowDataPacket[];
const params = (range: Range) => [PLACED, range.from, range.to];

export async function getReports(range: Range) {
  "use cache";
  cacheLife({ revalidate: 600 });
  cacheTag("reports");
  const [sales, products, places, payments, customers, coupons, carts, utm, inventory] = await Promise.all([
    db().query<Rows>(`SELECT DATE(o.created_at) AS date, COUNT(*) AS orders, SUM(o.total) AS revenue, SUM(o.discount) AS discounts FROM orders o WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY DATE(o.created_at) ORDER BY date`, params(range)),
    db().query<Rows>(`SELECT i.product_title AS product, i.variant_title AS size, SUM(i.quantity) AS units, SUM(i.line_total) AS revenue FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY i.product_title, i.variant_title ORDER BY revenue DESC LIMIT 100`, params(range)),
    db().query<Rows>(`SELECT o.state, o.city, COUNT(*) AS orders, SUM(o.total) AS revenue FROM orders o WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY o.state,o.city ORDER BY revenue DESC LIMIT 100`, params(range)),
    db().query<Rows>(`SELECT o.payment_method AS method, COUNT(*) AS orders, SUM(o.total) AS revenue, SUM(o.status='rto') AS rto FROM orders o WHERE (o.status IN (?) OR o.status='rto') AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY o.payment_method`, params(range)),
    db().query<Rows>(`SELECT CASE WHEN x.orders_count > 1 THEN 'Returning' ELSE 'New' END AS segment, COUNT(*) AS customers, SUM(x.revenue) AS revenue FROM (SELECT o.customer_id, COUNT(*) AS orders_count, SUM(o.total) AS revenue FROM orders o WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY o.customer_id) x GROUP BY segment`, params(range)),
    db().query<Rows>(`SELECT COALESCE(o.coupon_code,'No coupon') AS coupon, COUNT(*) AS orders, SUM(o.discount) AS discount, SUM(o.total) AS revenue FROM orders o WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY o.coupon_code ORDER BY orders DESC`, params(range)),
    db().query<Rows>(`SELECT COUNT(*) AS carts, SUM(status='converted') AS converted, SUM(status='converted' AND reminder_count>0) AS recovered, COALESCE(SUM(subtotal),0) AS value FROM carts WHERE item_count>0 AND DATE(created_at) BETWEEN ? AND ?`, [range.from, range.to]),
    db().query<Rows>(`SELECT COALESCE(NULLIF(o.utm_source,''),'Direct / unknown') AS source, COALESCE(NULLIF(o.utm_campaign,''),'—') AS campaign, COUNT(*) AS orders, SUM(o.total) AS revenue FROM orders o WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(o.utm_source,''),'Direct / unknown'), COALESCE(NULLIF(o.utm_campaign,''),'—') ORDER BY revenue DESC LIMIT 100`, params(range)),
    db().query<Rows>(`SELECT p.handle, p.title, v.title AS size, v.stock_qty, v.price, CASE WHEN v.stock_qty IS NULL THEN NULL ELSE v.stock_qty*v.price END AS value FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.status='active' ORDER BY p.title,v.sort_order`, []),
  ]);
  const map = (rows: Rows) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? null : typeof value === "number" ? value : String(value)])));
  return {
    range: { from: range.from, to: range.to, label: range.label },
    sales: map(sales[0]), products: map(products[0]), places: map(places[0]), payments: map(payments[0]),
    customers: map(customers[0]), coupons: map(coupons[0]), carts: map(carts[0]), utm: map(utm[0]), inventory: map(inventory[0]),
  };
}

export async function reportRows(report: string, range: Range) {
  const data = await getReports(range);
  const allowed: Record<string, keyof typeof data> = {
    sales: "sales", products: "products", places: "places", payments: "payments",
    customers: "customers", coupons: "coupons", carts: "carts", utm: "utm", inventory: "inventory",
  };
  const key = allowed[report] ?? "sales";
  return data[key] as Record<string, unknown>[];
}
