import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";
import { processOutbox, queueCartEmail, queueOrderEmail } from "@/lib/server/mail";
import { queueBackInStock, queueCartWhatsApp, queueOrderWhatsApp, processWhatsAppOutbox } from "@/lib/server/whatsapp";

/**
 * Customer nudges (every few minutes):
 * - abandoned carts: reminder 1 after 1 h idle, reminder 2 ~24 h later, by WhatsApp and/or email
 * - online orders whose payment didn't go through: one "complete your payment" nudge after 30 min
 * - back-in-stock alerts
 */
export async function GET(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [carts] = await db().query<RowDataPacket[]>(
    `SELECT id, reminder_count FROM carts
     WHERE status='active' AND (phone IS NOT NULL OR email IS NOT NULL) AND item_count > 0
       AND reminder_count < 2 AND last_activity_at < NOW() - INTERVAL 1 HOUR
       AND last_activity_at > NOW() - INTERVAL 7 DAY
       AND (reminder_sent_at IS NULL OR reminder_sent_at < NOW() - INTERVAL 20 HOUR)
     ORDER BY last_activity_at LIMIT 100`,
  );
  let abandoned = 0;
  for (const cart of carts) {
    const id = Number(cart.id);
    const second = Number(cart.reminder_count) > 0;
    const wa = await queueCartWhatsApp(id, second ? "abandoned_cart_24h" : "abandoned_cart_1h", false).catch(() => false);
    const mail = await queueCartEmail(id, second ? 2 : 1).catch((e) => (console.error("Cart reminder email", id, e), false));
    if (wa || mail) {
      await db().execute("UPDATE carts SET reminder_count = reminder_count + 1, reminder_sent_at = NOW() WHERE id = ?", [id]);
      abandoned++;
    }
  }

  // Payment didn't complete. Skip when the same customer has since placed a working order.
  const [unpaid] = await db().query<RowDataPacket[]>(
    `SELECT o.id FROM orders o
     WHERE o.status IN ('pending_payment','payment_failed') AND o.payment_method = 'payu'
       AND o.created_at < NOW() - INTERVAL 30 MINUTE AND o.created_at > NOW() - INTERVAL 24 HOUR
       AND NOT EXISTS (
         SELECT 1 FROM orders o2 WHERE o2.phone = o.phone AND o2.id > o.id
           AND o2.status NOT IN ('pending_payment','payment_failed','cancelled')
       )
     ORDER BY o.id LIMIT 50`,
  );
  let payment = 0;
  for (const row of unpaid) {
    const id = Number(row.id);
    const wa = await queueOrderWhatsApp(id, "payment_pending").catch(() => false);
    const mail = await queueOrderEmail(id, "payment_pending").catch((e) => (console.error("Payment reminder email", id, e), null));
    if (wa || mail) payment++;
  }

  const [waiting] = await db().query<RowDataPacket[]>(
    "SELECT id, phone, variant_key FROM back_in_stock WHERE notified_at IS NULL AND phone IS NOT NULL LIMIT 100",
  );
  let stock = 0;
  for (const row of waiting) {
    if (await queueBackInStock(String(row.phone), String(row.variant_key))) {
      await db().execute("UPDATE back_in_stock SET notified_at = NOW() WHERE id = ?", [row.id]);
      stock++;
    }
  }
  const [outbox, emails] = await Promise.all([processWhatsAppOutbox(), processOutbox().catch(() => null)]);
  return NextResponse.json({ abandoned, payment, stock, outbox, emails });
}
