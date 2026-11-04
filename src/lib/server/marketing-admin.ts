import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

export async function getMarketingSummary() {
  const [events] = await db().query<RowDataPacket[]>(
    `SELECT id, event_name, event_id, status, attempts, last_error, created_at, sent_at
     FROM marketing_outbox ORDER BY id DESC LIMIT 50`,
  );
  const [sources] = await db().query<RowDataPacket[]>(
    `SELECT COALESCE(NULLIF(utm_source, ''), 'Direct / unknown') AS source,
            COUNT(*) AS orders, SUM(total) AS revenue
     FROM orders WHERE status NOT IN ('cancelled', 'payment_failed')
     GROUP BY COALESCE(NULLIF(utm_source, ''), 'Direct / unknown')
     ORDER BY revenue DESC LIMIT 20`,
  );
  const [[counts]] = await db().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS orders, SUM(marketing_consent = 1) AS consented,
            SUM(utm_source IS NOT NULL AND utm_source <> '') AS attributed
     FROM orders WHERE status NOT IN ('cancelled', 'payment_failed')`,
  );
  return {
    events: events.map((row) => ({ id: Number(row.id), name: String(row.event_name), eventId: String(row.event_id), status: String(row.status), attempts: Number(row.attempts), error: row.last_error as string | null, createdAt: String(row.created_at), sentAt: row.sent_at as string | null })),
    sources: sources.map((row) => ({ source: String(row.source), orders: Number(row.orders), revenue: Number(row.revenue ?? 0) })),
    counts: { orders: Number(counts.orders), consented: Number(counts.consented ?? 0), attributed: Number(counts.attributed ?? 0) },
  };
}
