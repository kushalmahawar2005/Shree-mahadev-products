import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

const hash = (value: string | null | undefined) =>
  value ? createHash("sha256").update(value.trim().toLowerCase()).digest("hex") : null;

export async function queueMarketingEvent(
  eventName: "Purchase",
  eventId: string | number,
  orderId: number,
) {
  const [rows] = await db().execute(
    `SELECT order_no, phone, email, total, marketing_consent
     FROM orders WHERE id = ? LIMIT 1`,
    [orderId],
  ) as [{ [key: string]: unknown }[], unknown];
  const order = rows[0];
  if (!order || !order.marketing_consent) return;
  const payload = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(eventId),
    action_source: "website",
    user_data: {
      ph: hash(String(order.phone ?? "")),
      em: hash(String(order.email ?? "")),
    },
    custom_data: {
      currency: "INR",
      value: Number(order.total ?? 0),
      order_no: order.order_no,
    },
  };
  await db().execute(
    `INSERT IGNORE INTO marketing_outbox (event_name, event_id, order_id, payload)
     VALUES (?,?,?,?)`,
    [eventName, String(eventId), orderId, JSON.stringify(payload)],
  );
  void dispatchMarketingEvent(payload, orderId, String(eventId));
}

export async function processMarketingOutbox(limit = 25) {
  const [rows] = await db().execute(
    `SELECT id, event_name, event_id, order_id, payload, attempts
     FROM marketing_outbox
     WHERE status = 'pending' AND next_attempt <= NOW()
     ORDER BY id LIMIT ?`,
    [Math.min(Math.max(limit, 1), 100)],
  ) as [{ id: number; event_name: string; event_id: string; order_id: number; payload: string; attempts: number }[], unknown];
  let processed = 0;
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as Parameters<typeof dispatchMarketingEvent>[0];
      await dispatchMarketingEvent(payload, row.order_id, row.event_id);
      processed++;
    } catch (error) {
      console.error("processMarketingOutbox failed", { id: row.id, error });
      await db().execute(
        `UPDATE marketing_outbox
         SET attempts=attempts+1, next_attempt=DATE_ADD(NOW(), INTERVAL LEAST(60, POW(2, attempts)) MINUTE),
             last_error=?
         WHERE id=?`,
        [error instanceof Error ? error.message.slice(0, 500) : "Unknown marketing dispatch error", row.id],
      );
    }
  }
  return { processed, found: rows.length };
}

async function dispatchMarketingEvent(
  payload: {
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: string;
    user_data: { ph: string | null; em: string | null };
    custom_data: { currency: string; value: number; order_no: unknown };
  },
  orderId: number,
  eventId: string,
) {
  try {
    const requests: Promise<Response>[] = [];
    const pixelId = process.env.META_PIXEL_ID;
    const token = process.env.META_CAPI_TOKEN;
    if (pixelId && token) {
      requests.push(
        fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            access_token: token,
            test_event_code: process.env.META_TEST_EVENT_CODE,
            data: [{
              event_name: payload.event_name,
              event_time: payload.event_time,
              event_id: payload.event_id,
              action_source: payload.action_source,
              event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/order`,
              user_data: payload.user_data,
              custom_data: payload.custom_data,
            }],
          }),
          cache: "no-store",
        }),
      );
    }
    const measurementId = process.env.GA4_MEASUREMENT_ID;
    const apiSecret = process.env.GA4_API_SECRET;
    const clientId = payload.user_data.em ?? `smp.${eventId}`;
    if (measurementId && apiSecret) {
      requests.push(
        fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            events: [{
              name: "purchase",
              params: {
                transaction_id: payload.custom_data.order_no,
                value: payload.custom_data.value,
                currency: payload.custom_data.currency,
              },
            }],
          }),
          cache: "no-store",
        }),
      );
    }
    if (!requests.length) return;
    const responses = await Promise.all(requests);
    if (responses.some((response) => !response.ok)) {
      throw new Error("Marketing provider rejected an event");
    }
    await db().execute(
      "UPDATE marketing_outbox SET status='sent', sent_at=NOW() WHERE event_name=? AND event_id=?",
      [payload.event_name, eventId],
    );
  } catch (error) {
    console.error("dispatchMarketingEvent failed", { orderId, eventId, error });
  }
}
