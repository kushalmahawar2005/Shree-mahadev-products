// One-off (client WhatsApp list, 2026-11-10): which size each product opens on, the order products
// are listed in, and the missing Jaggery Block 1 kg product.
//   node scripts/apply-client-range.mjs [--dry]
// Jaggery Block is created as "coming soon" (size off sale, no price) until the client confirms its rate.
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.local");
} catch {
  // use real env vars
}
const dry = process.argv.includes("--dry");

// In the client's order. [handle, size shown first]
const RANGE = [
  ["groundnut-oil", "1 L"],
  ["yellow-mustard-oil", "1 L"],
  ["sunflower-oil", "1 L"],
  ["white-sesame-oil", "1 L"],
  ["brown-sesame-oil", "1 L"],
  ["coconut-oil", "1 L"],
  ["black-mustard-oil", "250 ml"],
  ["almond-oil", "250 ml"],
  ["walnut-oil", "250 ml"],
  ["flaxseed-oil", "250 ml"],
  ["castor-oil", "250 ml"],
  ["black-sesame-oil", "250 ml"],
  ["desi-khand", "800 g"],
  ["jaggery-powder", "800 g"],
  ["jamun-raw-honey", "1 kg"],
  ["sunderban-raw-honey", "1 kg"],
  ["van-tulsi-raw-honey", "1 kg"],
  ["jaggery-block", "1 kg"],
];

const c = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

await c.beginTransaction();
try {
  const [[block]] = await c.query("SELECT id FROM products WHERE handle = 'jaggery-block'");
  if (!block) {
    const [r] = await c.query(
      `INSERT INTO products (handle, title, title_hi, category, swatch, short_description, description_html, benefits, best_for, tags, faqs,
         seo_title, seo_description, status, default_size, sort_order)
       VALUES ('jaggery-block', 'Jaggery Block', 'गुड़ की भेली', 'sweetener', '#7A4A1E', 'Traditional gud bhheli for everyday sweetness.',
         '<p>Solid jaggery block (gud bhheli) made from sugarcane. TODO(client): product story.</p>',
         ?, ?, ?, '[]', 'Jaggery Block (गुड़ की भेली)', 'Traditional gud bhheli for everyday sweetness.', 'active', '1 kg', 0)`,
      [JSON.stringify(["Unrefined sugarcane jaggery", "Rich, earthy taste"]), JSON.stringify(["After meals", "Laddoo", "Chikki"]), JSON.stringify(["sweetener"])],
    );
    // TODO(client): rate for Jaggery Block 1 kg. Off sale (price 0) until then, so it shows "Coming soon".
    await c.query(
      `INSERT INTO product_variants (product_id, variant_key, title, size_value, size_unit, sku, price, compare_at_price, stock_qty, available, sort_order)
       VALUES (?, 'jaggery-block--1kg', '1 kg', 1000, 'g', 'SMP-JAGGERY-BLOCK-1KG', 0, NULL, NULL, 0, 0)`,
      [r.insertId],
    );
    await c.query(
      "INSERT INTO collection_products (collection_id, product_id) SELECT id, ? FROM collections WHERE handle = 'natural-sweeteners'",
      [r.insertId],
    );
    console.log("created jaggery-block (coming soon)");
  }

  for (const [i, [handle, size]] of RANGE.entries()) {
    const [[v]] = await c.query(
      "SELECT v.title FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.handle = ? AND LOWER(v.title) = LOWER(?)",
      [handle, size],
    );
    if (!v) {
      console.warn(`! ${handle}: no "${size}" size, skipped`);
      continue;
    }
    await c.query("UPDATE products SET default_size = ?, sort_order = ? WHERE handle = ?", [v.title, i, handle]);
    console.log(`${String(i).padStart(2)} ${handle} → ${v.title}`);
  }
  // Anything not in the list goes after it, in its old order.
  await c.query(
    "UPDATE products SET sort_order = sort_order + ? WHERE handle NOT IN (?)",
    [RANGE.length, RANGE.map(([h]) => h)],
  );

  if (dry) {
    await c.rollback();
    console.log("dry run: rolled back");
  } else {
    await c.commit();
  }
} catch (e) {
  await c.rollback();
  throw e;
} finally {
  await c.end();
}
