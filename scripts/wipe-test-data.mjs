// Go-live cleanup: removes ALL orders, customers, carts and test/demo activity so the store starts
// at zero (next order = SMP1001, first invoice = 0001). Catalog, photos, collections, banners,
// reels, settings, coupons, WhatsApp templates, admin users and stock levels are NOT touched.
// Reviews: everything except Google-imported ones.
//
// Usage: node scripts/wipe-test-data.mjs          → dry run (counts only)
//        node scripts/wipe-test-data.mjs --yes    → delete
// Reads DATABASE_* from .env.local / env.
import mysql from "mysql2/promise";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

try { process.loadEnvFile(".env.local"); } catch {}
const apply = process.argv.includes("--yes");

// Emptied completely (children before parents; FK checks are off during the run anyway).
const WIPE = [
  "order_items", "order_events", "order_returns", "payments", "refunds", "credit_notes", "invoices",
  "shipment_events", "shipments", "coupon_redemptions", "stock_reservations",
  "email_outbox", "whatsapp_outbox", "marketing_outbox", "webhook_logs",
  "support_ticket_photos", "support_tickets", "orders",
  "cart_items", "carts",
  "addresses", "customer_sessions", "customer_consents", "account_otps", "chat_guest_otps", "otp_codes", "back_in_stock", "customers",
  "leads", "inquiry_notes", "inquiries", "faq_feedback", "rate_limits", "inventory_log", "activity_log",
  "invoice_sequences", "credit_note_sequences", "whatsapp_optouts",
];

const db = await mysql.createConnection({ host: process.env.DATABASE_HOST, port: +(process.env.DATABASE_PORT ?? 3306), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
try {
  const [present] = await db.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()");
  const have = new Set(present.map((r) => r.t));
  const tables = WIPE.filter((t) => have.has(t));
  const counts = [];
  for (const t of tables) {
    const [[c]] = await db.query(`SELECT COUNT(*) n FROM \`${t}\``);
    if (c.n) counts.push(`${t}: ${c.n}`);
  }
  const [[rv]] = await db.query("SELECT COUNT(*) n FROM reviews WHERE source <> 'google'");
  const [orders] = await db.query("SELECT order_no, customer_name, total, status FROM orders ORDER BY id");
  console.log(`${apply ? "Deleting" : "Dry run — would delete"}:`);
  console.log("  " + (counts.join("\n  ") || "(nothing)"));
  console.log(`  reviews (non-Google) + their photos: ${rv.n}`);
  console.log(`  orders: ${orders.map((o) => `${o.order_no} ${o.customer_name} ₹${o.total} ${o.status}`).join(" | ") || "none"}`);
  if (!apply) {
    console.log("\nNothing changed. Run again with --yes to delete.");
    process.exit(0);
  }
  // Safety net: every row about to be deleted is written to a JSON file in the home folder first.
  const backup = {};
  for (const t of tables) [backup[t]] = await db.query(`SELECT * FROM \`${t}\``);
  [backup.reviews] = await db.query("SELECT * FROM reviews WHERE source <> 'google'");
  [backup.review_photos] = await db.query("SELECT rp.* FROM review_photos rp JOIN reviews r ON r.id = rp.review_id WHERE r.source <> 'google'");
  const file = join(homedir(), `smp-wipe-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(backup));
  console.log("Backup written:", file);
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  await db.query("DELETE rp FROM review_photos rp JOIN reviews r ON r.id = rp.review_id WHERE r.source <> 'google'");
  await db.query("DELETE FROM reviews WHERE source <> 'google'");
  // TRUNCATE also resets AUTO_INCREMENT, so the next order is SMP1001.
  for (const t of tables) await db.query(`TRUNCATE TABLE \`${t}\``);
  await db.query("ALTER TABLE orders AUTO_INCREMENT = 1");
  await db.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("\nDone. Store data is at zero; catalog and settings untouched.");
} finally {
  await db.end();
}
