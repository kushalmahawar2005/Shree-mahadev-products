import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { queueBackInStock, queueCartWhatsApp, processWhatsAppOutbox } from "@/lib/server/whatsapp";

export async function GET(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [carts] = await db().query<import("mysql2/promise").RowDataPacket[]>(
    `SELECT id, reminder_count FROM carts
     WHERE status='active' AND phone IS NOT NULL AND item_count > 0
       AND reminder_count < 2 AND last_activity_at < NOW() - INTERVAL 1 HOUR
       AND (reminder_sent_at IS NULL OR reminder_sent_at < NOW() - INTERVAL 12 HOUR)
     ORDER BY last_activity_at LIMIT 100`,
  );
  let abandoned = 0;
  for (const cart of carts) {
    if (await queueCartWhatsApp(Number(cart.id), Number(cart.reminder_count) ? "abandoned_cart_24h" : "abandoned_cart_1h")) abandoned++;
  }
  const [waiting] = await db().query<import("mysql2/promise").RowDataPacket[]>(
    "SELECT id, phone, variant_key FROM back_in_stock WHERE notified_at IS NULL AND phone IS NOT NULL LIMIT 100",
  );
  let stock = 0;
  for (const row of waiting) {
    if (await queueBackInStock(String(row.phone), String(row.variant_key))) {
      await db().execute("UPDATE back_in_stock SET notified_at = NOW() WHERE id = ?", [row.id]);
      stock++;
    }
  }
  const outbox = await processWhatsAppOutbox();
  return NextResponse.json({ abandoned, stock, outbox });
}
