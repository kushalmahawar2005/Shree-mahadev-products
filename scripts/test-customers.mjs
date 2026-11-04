// Customer filters and protected CSV export against a running dev server.
// Usage: pnpm test:customers [baseUrl]
import { createHmac, randomBytes } from "node:crypto";
import mysql from "mysql2/promise";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const db = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
const run = randomBytes(4).toString("hex");
const names = {
  repeat: `Prompt9 Repeat ${run}`,
  old: `Prompt9 Old COD ${run}`,
  rto: `Prompt9 RTO ${run}`,
};
const phoneBase = String(Number.parseInt(run, 16) % 1_000_000).padStart(6, "0");
const phones = Object.fromEntries(
  Object.keys(names).map((key, i) => [
    key,
    `97${phoneBase}${String(i).padStart(2, "0")}`,
  ]),
);
let pass = true;
const check = (ok, message) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) pass = false;
};

function adminCookie(username, version) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, v: version, exp: Date.now() + 600_000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `smp_admin=${payload}.${signature}`;
}

async function addCustomer(key, orderData) {
  const phone = phones[key];
  const [customerResult] = await db.execute(
    "INSERT INTO customers (phone, email, name) VALUES (?, ?, ?)",
    [phone, `${phone}@prompt9.test`, names[key]],
  );
  const customerId = customerResult.insertId;
  await db.execute(
    "INSERT INTO addresses (customer_id, name, phone, line1, city, state, pincode) VALUES (?, ?, ?, 'Test road', 'Bijainagar', 'Rajasthan', '305624')",
    [customerId, names[key], phone],
  );
  for (const [i, order] of orderData.entries()) {
    const total = order.total;
    await db.execute(
      `INSERT INTO orders (order_no, token, customer_id, status, payment_method, customer_name, phone, email,
       address_line1, city, state, pincode, subtotal, total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Test road', 'Bijainagar', 'Rajasthan', '305624', ?, ?, ?)`,
      [
        `P9${run}${key}${i}`,
        randomBytes(16).toString("hex"),
        customerId,
        order.status,
        order.method,
        names[key],
        phone,
        `${phone}@prompt9.test`,
        total,
        total,
        order.when,
      ],
    );
  }
  return customerId;
}

try {
  const [[admin]] = await db.query(
    "SELECT username, session_version FROM admin_users WHERE username=?",
    [process.env.ADMIN_USER ?? "admin"],
  );
  if (!admin) throw new Error("Test admin user not found.");
  const cookie = adminCookie(admin.username, Number(admin.session_version));

  const repeatId = await addCustomer("repeat", [
    {
      status: "paid",
      method: "payu",
      total: 3200,
      when: "2026-10-20 10:00:00",
    },
    {
      status: "delivered",
      method: "cod",
      total: 3000,
      when: "2026-10-25 10:00:00",
    },
  ]);
  await addCustomer("old", [
    { status: "paid", method: "cod", total: 6000, when: "2026-07-20 10:00:00" },
  ]);
  await addCustomer("rto", [
    {
      status: "cod_pending",
      method: "cod",
      total: 900,
      when: "2026-10-28 10:00:00",
    },
    { status: "rto", method: "cod", total: 900, when: "2026-10-29 10:00:00" },
  ]);

  async function page(filter, name) {
    const query = new URLSearchParams({ f: filter, q: name });
    const response = await fetch(`${BASE}/admin/customers?${query}`, {
      headers: { Cookie: cookie },
    });
    return { status: response.status, html: await response.text() };
  }
  const checks = [
    ["repeat", names.repeat, "repeat buyer"],
    ["one_time", names.old, "one-time buyer"],
    ["high_value", names.old, "lifetime value threshold"],
    ["inactive_90d", names.old, "inactive 90-day filter"],
    ["cod_only", names.old, "COD-only filter"],
    ["rto", names.rto, "RTO history filter"],
  ];
  for (const [filter, name, label] of checks) {
    const response = await page(filter, name);
    check(
      response.status === 200 && response.html.includes(name),
      `${label} includes the matching customer`,
    );
  }

  const csvResponse = await fetch(
    `${BASE}/admin/customers/export?f=repeat&q=${encodeURIComponent(names.repeat)}`,
    { headers: { Cookie: cookie } },
  );
  const csv = await csvResponse.text();
  check(
    csvResponse.status === 200 &&
      csv.includes(
        '"name","phone","email","city","state","orders","LTV","last order"',
      ),
    "CSV export returns the expected header",
  );
  check(
    csv.includes(names.repeat) && !csv.includes(names.old),
    "CSV export respects active filters and search",
  );
  const [[log]] = await db.execute(
    "SELECT COUNT(*) AS n FROM activity_log WHERE action='customers.exported' AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.search'))=?",
    [names.repeat],
  );
  check(Number(log.n) > 0, "CSV export is recorded in the activity log");
  const unauthenticated = await fetch(`${BASE}/admin/customers/export`, {
    redirect: "manual",
  });
  check(
    unauthenticated.status === 401 || unauthenticated.status === 307,
    `CSV export rejects requests without an admin session (HTTP ${unauthenticated.status})`,
  );

  const detail = await fetch(`${BASE}/admin/customers/view?id=${repeatId}`, {
    headers: { Cookie: cookie },
  });
  const detailHtml = await detail.text();
  check(
    detail.status === 200 &&
      detailHtml.includes("Notes and tags") &&
      detailHtml.includes("WhatsApp"),
    "customer detail shows notes, tags, and contact controls",
  );
} finally {
  const customerIds = ["repeat", "old", "rto"].map((key) => phones[key]);
  const [customerRows] = await db.query(
    "SELECT id FROM customers WHERE phone IN (?)",
    [customerIds],
  );
  const ids = customerRows.map((r) => r.id);
  if (ids.length) {
    await db.query("DELETE FROM orders WHERE customer_id IN (?)", [ids]);
    await db.query("DELETE FROM addresses WHERE customer_id IN (?)", [ids]);
    await db.query("DELETE FROM customers WHERE id IN (?)", [ids]);
  }
  await db.execute(
    "DELETE FROM activity_log WHERE action='customers.exported' AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.search')) LIKE ?",
    [`Prompt9 % ${run}`],
  );
  await db.end();
}
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
