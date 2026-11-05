import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { mailConfigured } from "./mail";
import { nimbusConfigured } from "./nimbuspost";
import { payuConfigured } from "./payu";
import { getStoreSettings } from "./store-settings";

type Rows = RowDataPacket[];

/** Orders that count as sales (placed and not undone). */
export const PLACED = [
  "paid",
  "cod_pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "partially_refunded",
];

export type Preset = "today" | "7d" | "30d" | "month" | "custom";
export type Range = {
  preset: Preset;
  from: string;
  to: string;
  days: number;
  prevFrom: string;
  prevTo: string;
  label: string;
};

const istToday = () =>
  new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
const diffDays = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
const isDate = (s?: string) =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Inclusive IST date range from URL params, plus the previous period of the same length. */
export function resolveRange(
  preset?: string,
  fromQ?: string,
  toQ?: string,
): Range {
  const today = istToday();
  let from = today,
    to = today,
    p: Preset = "7d",
    label = "Last 7 days";
  switch (preset) {
    case "today":
      p = "today";
      label = "Today";
      break;
    case "30d":
      p = "30d";
      from = addDays(today, -29);
      label = "Last 30 days";
      break;
    case "month":
      p = "month";
      from = `${today.slice(0, 8)}01`;
      label = "This month";
      break;
    case "custom":
      if (
        isDate(fromQ) &&
        isDate(toQ) &&
        fromQ! <= toQ! &&
        diffDays(fromQ!, toQ!) <= 366
      ) {
        p = "custom";
        from = fromQ!;
        to = toQ!;
        label = `${from} → ${to}`;
        break;
      }
    // fall through to 7d on bad input
    default:
      p = "7d";
      from = addDays(today, -6);
      label = "Last 7 days";
  }
  const days = diffDays(from, to) + 1;
  return {
    preset: p,
    from,
    to,
    days,
    prevFrom: addDays(from, -days),
    prevTo: addDays(from, -1),
    label,
  };
}

async function kpis(from: string, to: string) {
  const [[o]] = await db().query<Rows>(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS gross, COALESCE(SUM(payment_method='cod'),0) AS cod,
       COUNT(DISTINCT customer_id) AS customers
     FROM orders WHERE status IN (?) AND DATE(created_at) BETWEEN ? AND ?`,
    [PLACED, from, to],
  );
  const [[r]] = await db().query<Rows>(
    "SELECT COALESCE(SUM(amount),0) AS refunded FROM refunds WHERE status = 'success' AND DATE(created_at) BETWEEN ? AND ?",
    [from, to],
  );
  const [[ship]] = await db().query<Rows>(
    `SELECT COALESCE(SUM(status='rto'),0) AS rto, COALESCE(SUM(status IN ('shipped','delivered','rto')),0) AS outbound
     FROM orders WHERE DATE(created_at) BETWEEN ? AND ?`,
    [from, to],
  );
  const [[nc]] = await db().query<Rows>(
    `SELECT COUNT(*) AS n FROM (SELECT customer_id, MIN(created_at) AS first FROM orders WHERE status IN (?) AND customer_id IS NOT NULL GROUP BY customer_id) f
     WHERE DATE(f.first) BETWEEN ? AND ?`,
    [PLACED, from, to],
  );
  const [[ac]] = await db().query<Rows>(
    // A cart only counts as converted when its order is a placed sale (same rule as
    // "Orders placed"), so cancelled/unpaid test orders can't inflate conversion.
    `SELECT COUNT(*) AS carts, COALESCE(SUM(c.subtotal),0) AS value,
       COALESCE(SUM(c.status='converted' AND o.status IN (?)),0) AS converted,
       COALESCE(SUM(c.status='converted' AND o.status IN (?) AND c.reminder_count>0),0) AS recovered,
       COALESCE(SUM(c.status='active' AND c.reached_checkout=1 AND c.last_activity_at < NOW() - INTERVAL 30 MINUTE),0) AS abandoned_checkouts
     FROM carts c LEFT JOIN orders o ON o.id = c.order_id
     WHERE c.item_count > 0 AND DATE(c.created_at) BETWEEN ? AND ?`,
    [PLACED, PLACED, from, to],
  );
  const orders = Number(o.orders),
    gross = Number(o.gross),
    refunded = Number(r.refunded);
  const outbound = Number(ship.outbound);
  return {
    orders,
    gross,
    refunded,
    net: gross - refunded,
    aov: orders ? Math.round(gross / orders) : null,
    codShare: orders ? Number(o.cod) / orders : null,
    rtoRate: outbound ? Number(ship.rto) / outbound : null,
    customers: Number(o.customers),
    newCustomers: Number(nc.n),
    carts: Number(ac.carts),
    convertedCarts: Number(ac.converted),
    conversion: Number(ac.carts)
      ? Number(ac.converted) / Number(ac.carts)
      : null,
    recovered: Number(ac.recovered),
    abandonedCheckouts: Number(ac.abandoned_checkouts),
  };
}
export type Kpis = Awaited<ReturnType<typeof kpis>>;

export async function getDashboard(range: Range) {
  const [cur, prev] = await Promise.all([
    kpis(range.from, range.to),
    kpis(range.prevFrom, range.prevTo),
  ]);
  const [daily] = await db().query<Rows>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS orders, SUM(total) AS gross
     FROM orders WHERE status IN (?) AND DATE(created_at) BETWEEN ? AND ? GROUP BY d ORDER BY d`,
    [PLACED, range.from, range.to],
  );
  const byDay = new Map(
    daily.map((r) => [
      r.d as string,
      { orders: Number(r.orders), gross: Number(r.gross) },
    ]),
  );
  const series = Array.from({ length: Math.min(range.days, 366) }, (_, i) => {
    const d = new Date(Date.parse(`${range.from}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date: d, ...(byDay.get(d) ?? { orders: 0, gross: 0 }) };
  });
  const [prevDaily] = await db().query<Rows>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, SUM(total) AS gross
     FROM orders WHERE status IN (?) AND DATE(created_at) BETWEEN ? AND ? GROUP BY d`,
    [PLACED, range.prevFrom, range.prevTo],
  );
  const prevByDay = new Map(prevDaily.map((r) => [r.d as string, Number(r.gross)]));
  // Previous period aligned day-by-day with the current one (for the comparison line).
  const seriesWithPrev = series.map((point, i) => {
    const d = new Date(Date.parse(`${range.prevFrom}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    return { ...point, prevGross: prevByDay.get(d) ?? 0 };
  });
  const [topProducts] = await db().query<Rows>(
    `SELECT i.product_handle AS handle, i.product_title AS title, SUM(i.quantity) AS units, SUM(i.line_total) AS revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ?
     GROUP BY i.product_handle, i.product_title ORDER BY revenue DESC LIMIT 6`,
    [PLACED, range.from, range.to],
  );
  const [topSizes] = await db().query<Rows>(
    `SELECT i.product_title AS title, i.variant_title AS size, SUM(i.quantity) AS units, SUM(i.line_total) AS revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status IN (?) AND DATE(o.created_at) BETWEEN ? AND ?
     GROUP BY i.product_title, i.variant_title ORDER BY units DESC LIMIT 6`,
    [PLACED, range.from, range.to],
  );
  const [topPlaces] = await db().query<Rows>(
    `SELECT state, city, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE status IN (?) AND DATE(created_at) BETWEEN ? AND ?
     GROUP BY state, city ORDER BY revenue DESC LIMIT 6`,
    [PLACED, range.from, range.to],
  );
  const n = (v: unknown) => Number(v);
  return {
    cur,
    prev,
    series: seriesWithPrev,
    topProducts: topProducts.map((r) => ({
      handle: r.handle as string,
      title: r.title as string,
      units: n(r.units),
      revenue: n(r.revenue),
    })),
    topSizes: topSizes.map((r) => ({
      title: r.title as string,
      size: r.size as string,
      units: n(r.units),
      revenue: n(r.revenue),
    })),
    topPlaces: topPlaces.map((r) => ({
      state: r.state as string,
      city: r.city as string,
      orders: n(r.orders),
      revenue: n(r.revenue),
    })),
  };
}

export async function getDashboardOperations() {
  const settings = await getStoreSettings();
  const [stockRows, cartRows] = await Promise.all([
    db().query<Rows>(
      `SELECT p.handle, p.title, v.title AS variant_title, v.stock_qty
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE p.status='active' AND v.available=1 AND v.stock_qty IS NOT NULL AND v.stock_qty <= ?
       ORDER BY v.stock_qty ASC, p.title ASC LIMIT 5`,
      [settings.lowStockThreshold],
    ),
    db().query<Rows>(
      `SELECT id, name, subtotal, phone, last_activity_at
       FROM carts WHERE status='active' AND item_count>0 AND phone IS NOT NULL AND reminder_count=0
         AND created_at > NOW() - INTERVAL 7 DAY
         AND last_activity_at < NOW() - INTERVAL 30 MINUTE
       ORDER BY last_activity_at DESC LIMIT 4`,
    ),
  ]);
  return {
    lowStock: stockRows[0].map((r) => ({
      handle: r.handle as string,
      title: r.title as string,
      variant: r.variant_title as string,
      stock: Number(r.stock_qty),
    })),
    carts: cartRows[0].map((r) => ({
      id: Number(r.id),
      name: (r.name as string | null) ?? "Shopper",
      subtotal: Number(r.subtotal),
      phone: r.phone as string,
      lastActivityAt: String(r.last_activity_at),
    })),
  };
}

export type Attention = {
  key: string;
  label: string;
  count: number;
  href: string;
  tone: "red" | "amber" | "gray";
  note?: string;
};

/** Things that need someone today (not limited to the date range). Zero-count rows are dropped. */
export async function getAttention(): Promise<Attention[]> {
  const q = async (sql: string, p: unknown[] = []) =>
    Number(((await db().query<Rows>(sql, p))[0][0] ?? { n: 0 }).n);
  const settings = await getStoreSettings();
  const [
    toShip,
    codConfirm,
    payPending,
    rto,
    inquiries,
    inquiryFollowUps,
    reviews,
    out,
    low,
    waiting,
    failedMail,
    abandoned,
  ] = await Promise.all([
    q(
      `SELECT COUNT(*) n FROM orders o WHERE o.status IN ('paid','confirmed') AND NOT EXISTS (SELECT 1 FROM shipments s WHERE s.order_id=o.id AND s.status<>'cancelled')`,
    ),
    q("SELECT COUNT(*) n FROM orders WHERE status='cod_pending'"),
    q(
      "SELECT COUNT(*) n FROM orders WHERE status='pending_payment' AND created_at < NOW() - INTERVAL 15 MINUTE",
    ),
    q("SELECT COUNT(*) n FROM orders WHERE status='rto'"),
    q("SELECT COUNT(*) n FROM inquiries WHERE status='new'"),
    q(
      "SELECT COUNT(*) n FROM inquiries WHERE kind='bulk' AND follow_up_at <= CURDATE() AND status NOT IN ('won','lost')",
    ),
    q("SELECT COUNT(*) n FROM reviews WHERE status='pending'"),
    q(
      "SELECT COUNT(*) n FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.status='active' AND v.available=1 AND v.stock_qty IS NOT NULL AND v.stock_qty<=0",
    ),
    q(
      "SELECT COUNT(*) n FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.status='active' AND v.available=1 AND v.stock_qty>0 AND v.stock_qty<=?",
      [settings.lowStockThreshold],
    ),
    q("SELECT COUNT(*) n FROM back_in_stock WHERE notified_at IS NULL"),
    q("SELECT COUNT(*) n FROM email_outbox WHERE status='failed'"),
    q(
      "SELECT COUNT(*) n FROM carts WHERE status='active' AND item_count>0 AND phone IS NOT NULL AND reminder_count=0 AND last_activity_at < NOW() - INTERVAL 30 MINUTE AND created_at > NOW() - INTERVAL 7 DAY",
    ),
  ]);
  const list: Attention[] = [
    {
      key: "ship",
      label: "Orders to ship",
      count: toShip,
      href: "/admin/orders?f=to_ship",
      tone: "red",
    },
    {
      key: "cod",
      label: "COD orders to confirm",
      count: codConfirm,
      href: "/admin/orders?f=to_ship",
      tone: "amber",
    },
    {
      key: "pay",
      label: "Payments pending over 15 min",
      count: payPending,
      href: "/admin/orders?f=awaiting_payment",
      tone: "amber",
    },
    {
      key: "rto",
      label: "RTO shipments to receive back",
      count: rto,
      href: "/admin/orders?f=cancelled",
      tone: "red",
    },
    {
      key: "abandoned",
      label: "Abandoned checkouts to message",
      count: abandoned,
      href: "/admin/abandoned-carts",
      tone: "amber",
    },
    {
      key: "out",
      label: "Sizes out of stock",
      count: out,
      href: "/admin/inventory",
      tone: "red",
    },
    {
      key: "low",
      label: `Sizes at or below ${settings.lowStockThreshold} in stock`,
      count: low,
      href: "/admin/inventory",
      tone: "amber",
    },
    {
      key: "waiting",
      label: "Back-in-stock requests waiting",
      count: waiting,
      href: "/admin/inventory",
      tone: "gray",
    },
    {
      key: "inq",
      label: "New bulk inquiries",
      count: inquiries,
      href: "/admin/inquiries",
      tone: "amber",
    },
    {
      key: "inq_follow_up",
      label: "Inquiry follow-ups due today",
      count: inquiryFollowUps,
      href: "/admin/inquiries?f=due",
      tone: "amber",
    },
    {
      key: "rev",
      label: "Reviews to moderate",
      count: reviews,
      href: "/admin/reviews",
      tone: "gray",
    },
    {
      key: "mail",
      label: "Emails that failed to send",
      count: failedMail,
      href: "/admin/settings",
      tone: "red",
    },
  ].filter((a) => a.count > 0) as Attention[];

  const exp = settings.business.fssaiExpiry;
  if (exp) {
    const days = Math.ceil(
      (Date.parse(`${exp}T00:00:00+05:30`) - Date.now()) / 86_400_000,
    );
    if (days <= 30)
      list.unshift({
        key: "fssai",
        label:
          days < 0
            ? "FSSAI licence has expired"
            : `FSSAI licence expires in ${days} day${days === 1 ? "" : "s"}`,
        count: 1,
        href: "/admin/settings",
        tone: "red",
        note: exp,
      });
  }
  if (!payuConfigured())
    list.push({
      key: "payu",
      label: "PayU keys missing: online payments are off",
      count: 1,
      href: "/admin/settings",
      tone: "red",
    });
  else if (process.env.PAYU_MODE !== "live")
    list.push({
      key: "payu_test",
      label: "PayU is in test mode: real payments are not being captured",
      count: 1,
      href: "/admin/settings",
      tone: "amber",
    });
  if (!mailConfigured())
    list.push({
      key: "resend",
      label: "Resend key missing: order emails are waiting",
      count: 1,
      href: "/admin/settings",
      tone: "amber",
    });
  if (!nimbusConfigured())
    list.push({
      key: "nimbus",
      label: "NimbusPost keys missing: courier rates use the flat fee",
      count: 1,
      href: "/admin/settings",
      tone: "amber",
    });
  return list;
}
