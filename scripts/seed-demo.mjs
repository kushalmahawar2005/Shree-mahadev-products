// Local-only demo data so admin reports/dashboards have something to show.
//   node scripts/seed-demo.mjs          -> (re)seed demo customers, orders, reviews
//   node scripts/seed-demo.mjs --clean  -> remove every demo row
// Demo rows are marked: order_no 'DEMO…', customer email '@demo.local', review source 'demo'.
// Never run against production.
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.local");
} catch {
  // use real env vars
}
if (process.env.NODE_ENV === "production" || /hstgr|hostinger/i.test(process.env.DATABASE_HOST ?? "")) {
  console.error("Refusing to seed demo data on a production database.");
  process.exit(1);
}

const db = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

async function clean() {
  const [orders] = await db.query("SELECT id FROM orders WHERE order_no LIKE 'DEMO%'");
  const ids = orders.map((o) => o.id);
  if (ids.length) {
    await db.query("DELETE FROM coupon_redemptions WHERE order_id IN (?)", [ids]);
    await db.query("DELETE FROM order_items WHERE order_id IN (?)", [ids]);
    await db.query("DELETE FROM orders WHERE id IN (?)", [ids]);
  }
  await db.query("DELETE FROM reviews WHERE source = 'demo'");
  const [cust] = await db.query("SELECT id FROM customers WHERE email LIKE '%@demo.local'");
  if (cust.length) {
    await db.query("DELETE FROM addresses WHERE customer_id IN (?)", [cust.map((c) => c.id)]);
    await db.query("DELETE FROM customers WHERE id IN (?)", [cust.map((c) => c.id)]);
  }
  console.log(`Removed ${ids.length} demo orders, ${cust.length} demo customers.`);
}

await clean();
if (process.argv.includes("--clean")) {
  await db.end();
  process.exit(0);
}

// Deterministic pseudo-random so reruns look the same.
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const [variants] = await db.query(
  "SELECT p.handle, p.title, v.variant_key, v.title AS vt, v.price FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.price > 0 AND v.price < 3000",
);
if (!variants.length) throw new Error("No product variants found. Seed the catalog first.");
const [[coupon]] = await db.query("SELECT id, code, value FROM coupons WHERE kind = 'percent' ORDER BY id LIMIT 1");

const people = [
  ["Ramesh Sharma", "Ajmer", "Rajasthan", "305001"], ["Sunita Jain", "Bhilwara", "Rajasthan", "311001"],
  ["Mahesh Agarwal", "Jaipur", "Rajasthan", "302017"], ["Pooja Mehta", "Ahmedabad", "Gujarat", "380015"],
  ["Anil Kumawat", "Bijainagar", "Rajasthan", "305624"], ["Kavita Rathore", "Udaipur", "Rajasthan", "313001"],
  ["Vikas Gupta", "Delhi", "Delhi", "110085"], ["Neha Soni", "Indore", "Madhya Pradesh", "452001"],
  ["Suresh Choudhary", "Kishangarh", "Rajasthan", "305801"], ["Priya Iyer", "Bengaluru", "Karnataka", "560034"],
  ["Deepak Joshi", "Pune", "Maharashtra", "411038"], ["Rekha Verma", "Beawar", "Rajasthan", "305901"],
  ["Arjun Singh", "Jodhpur", "Rajasthan", "342001"], ["Meena Patel", "Surat", "Gujarat", "395007"],
  ["Gaurav Malhotra", "Gurugram", "Haryana", "122002"], ["Anita Bansal", "Kota", "Rajasthan", "324005"],
  ["Rohit Saini", "Chandigarh", "Chandigarh", "160017"], ["Shalini Mishra", "Lucknow", "Uttar Pradesh", "226010"],
];
const sources = [
  [null, null, null], [null, null, null], ["google", "cpc", "oil_search"], ["facebook", "paid_social", "diwali_sale"],
  ["instagram", "social", "reels_ghani"], ["whatsapp", "message", "repeat_buyers"],
];
const statuses = ["delivered", "delivered", "delivered", "shipped", "paid", "paid", "confirmed", "cod_pending", "packed", "cancelled", "rto"];

const customers = [];
for (let i = 0; i < people.length; i++) {
  const [name, city, state, pin] = people[i];
  const phone = `90010${String(10000 + i).slice(-5)}`;
  const email = `${name.split(" ")[0].toLowerCase()}${i}@demo.local`;
  const [r] = await db.execute(
    "INSERT INTO customers (phone, email, name, notes, created_at) VALUES (?, ?, ?, 'Demo customer (seed-demo.mjs)', NOW() - INTERVAL ? DAY)",
    [phone, email, name, 10 + Math.floor(rnd() * 40)],
  );
  const line1 = `${10 + i}, Shanti Nagar`;
  await db.execute("INSERT INTO addresses (customer_id, name, phone, line1, city, state, pincode) VALUES (?, ?, ?, ?, ?, ?, ?)", [r.insertId, name, phone, line1, city, state, pin]);
  customers.push({ id: r.insertId, name, phone, email, city, state, pin, line1 });
}

let n = 1001;
let made = 0;
for (let day = 0; day < 30; day++) {
  const perDay = day === 0 ? 3 : 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < perDay; k++) {
    // repeat buyers: first 6 customers order more often
    const c = rnd() < 0.4 ? customers[Math.floor(rnd() * 6)] : pick(customers);
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ v: pick(variants), q: 1 + Math.floor(rnd() * 2) }));
    const subtotal = lines.reduce((s, l) => s + l.v.price * l.q, 0);
    const useCoupon = coupon && rnd() < 0.2;
    const discount = useCoupon ? Math.round((subtotal * coupon.value) / 100) : 0;
    const cod = rnd() < 0.35;
    const shipping = subtotal >= 999 ? 0 : 60;
    const codFee = cod ? 40 : 0;
    const total = subtotal - discount + shipping + codFee;
    const status = day === 0 ? pick(["paid", "cod_pending", "confirmed"]) : pick(statuses);
    const [src, medium, campaign] = pick(sources);
    const minutesAgo = day * 1440 + Math.floor(rnd() * (day === 0 ? 300 : 1300));
    const [o] = await db.execute(
      `INSERT INTO orders (order_no, token, customer_id, source, status, payment_method, customer_name, phone, email,
         address_line1, city, state, pincode, subtotal, discount, coupon_code, shipping, cod_fee, total,
         utm_source, utm_medium, utm_campaign, marketing_consent, paid_at, cancelled_at, created_at, admin_note)
       VALUES (?, ?, ?, 'web', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         IF(? = 'payu' AND ? NOT IN ('cancelled'), NOW() - INTERVAL ? MINUTE, NULL),
         IF(? = 'cancelled', NOW() - INTERVAL ? MINUTE, NULL),
         NOW() - INTERVAL ? MINUTE, 'Demo order (seed-demo.mjs)')`,
      [
        `DEMO${n}`, randomBytes(16).toString("hex"), c.id, status, cod ? "cod" : "payu", c.name, c.phone, c.email,
        c.line1, c.city, c.state, c.pin, subtotal, discount, useCoupon ? coupon.code : null, shipping, codFee, total,
        src, medium, campaign, rnd() < 0.7 ? 1 : 0,
        cod ? "cod" : "payu", status, minutesAgo - 2, status, Math.max(0, minutesAgo - 60), minutesAgo,
      ],
    );
    for (const l of lines) {
      await db.execute(
        "INSERT INTO order_items (order_id, variant_key, product_handle, product_title, variant_title, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [o.insertId, l.v.variant_key, l.v.handle, l.v.title, l.v.vt, l.v.price, l.q, l.v.price * l.q],
      );
    }
    if (useCoupon) {
      await db.execute("INSERT INTO coupon_redemptions (coupon_id, order_id, phone, amount) VALUES (?, ?, ?, ?)", [coupon.id, o.insertId, c.phone, discount]);
    }
    n++;
    made++;
  }
}

const reviewText = [
  [5, "Asli kachi ghani swad", "Smell and taste is just like the oil my nani used to get from the village ghani. Will order again."],
  [5, "Very good quality", "Packing was neat, no leakage. Groundnut oil is thick and fresh."],
  [4, "Good, delivery took 5 days", "Oil quality is very good. Delivery could be a little faster."],
  [5, "Family loved it", "Using mustard oil for achaar this season. Strong, pure flavour."],
  [3, "Okay", "Taste is fine but the bottle cap was a bit loose."],
  [5, "Pure groundnut smell", "You can smell the peanuts the moment you open it. Puri and pakode came out crisp, not heavy."],
  [5, "Honey crystallised, as promised", "Jamun honey is dark and tangy. It set a little in winter, which tells me it is not processed."],
  [4, "Good for champi", "Using the coconut oil for my hair and my mother's knees. Light and absorbs well."],
  [5, "Will switch fully", "Moved the whole family off refined oil. Food tastes like home again."],
  [5, "Fast delivery to Jaipur", "Reached in 3 days, well packed in a box with bubble wrap. Mustard oil is sharp and fresh."],
];
for (let i = 0; i < reviewText.length; i++) {
  const [rating, title, body] = reviewText[i];
  const c = customers[i];
  await db.execute(
    "INSERT INTO reviews (product_handle, name, city, rating, title, body, status, featured, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'demo', NOW() - INTERVAL ? DAY)",
    [pick(variants).handle, c.name, c.city, rating, title, body, i === 4 ? "pending" : "approved", i === 4 ? 0 : 1, i + 1],
  );
}

console.log(`Seeded ${customers.length} demo customers, ${made} demo orders, ${reviewText.length} demo reviews.`);
await db.end();
