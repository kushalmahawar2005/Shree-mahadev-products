// End-to-end bulk inquiry, admin pipeline, follow-up, and manual order test.
// Usage: pnpm test:inquiries [baseUrl]
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const MANIFEST_ROOT = process.env.TEST_MANIFEST_DIR ?? ".next/dev";
const db = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
const run = randomBytes(3).toString("hex");
const suffix = String(Number.parseInt(run, 16) % 1_000_000).padStart(6, "0");
const email = `prompt10-${run}@example.test`;
const phone = `96${suffix}00`;
const name = `Prompt 10 Lead ${run}`;
let inquiryId = 0;
let orderId = 0;
let pass = true;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) pass = false;
};

const walk = (dir) =>
  readdirSync(dir).flatMap((file) =>
    statSync(join(dir, file)).isDirectory()
      ? walk(join(dir, file))
      : [join(dir, file)],
  );
const actionId = (name) => {
  for (const file of walk(MANIFEST_ROOT).filter((path) =>
    path.endsWith("server-reference-manifest.json"),
  )) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, action] of Object.entries(manifest.node ?? {}))
      if (action.exportedName === name) return id;
  }
  throw new Error(`Action ${name} not found. Open the page in dev first.`);
};
const [[admin]] = await db.query(
  "SELECT username, session_version FROM admin_users WHERE username=?",
  [process.env.ADMIN_USER ?? "admin"],
);
if (!admin) throw new Error("Test admin user not found.");
const payload = Buffer.from(
  JSON.stringify({
    u: admin.username,
    v: Number(admin.session_version),
    exp: Date.now() + 600_000,
  }),
).toString("base64url");
const cookie = `smp_admin=${payload}.${createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url")}`;

async function action(path, name, args, authenticated = true) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Next-Action": actionId(name),
      "Content-Type": "text/plain;charset=UTF-8",
      ...(authenticated ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify([args]),
    redirect: "manual",
  });
  return { status: response.status, body: await response.text() };
}

try {
  const [[variant]] = await db.query(
    "SELECT v.variant_key, v.price FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.status='active' AND v.available=1 AND v.stock_qty IS NULL LIMIT 1",
  );
  if (!variant)
    throw new Error(
      "No active untracked product variant available for the manual order test.",
    );

  const submission = await action(
    "/bulk-orders",
    "submitBulkInquiryAction",
    {
      name,
      business: `Test Shop ${run}`,
      city: "Bijainagar",
      phone,
      email,
      product: "Groundnut Oil",
      quantity: "3 tins of 15L",
      message: "Please call after 3pm",
      website: "",
    },
    false,
  );
  check(
    submission.status === 200 && submission.body.includes('"ok":true'),
    "public form action accepts and saves a valid inquiry",
  );
  const [[inquiry]] = await db.query(
    "SELECT id, status FROM inquiries WHERE email=? ORDER BY id DESC LIMIT 1",
    [email],
  );
  if (!inquiry) throw new Error("Submitted inquiry was not saved.");
  inquiryId = Number(inquiry.id);

  const status = await action("/admin/inquiries", "updateInquiryStatusAction", {
    id: inquiryId,
    status: "contacted",
  });
  check(status.body.includes('"ok":true'), "admin moves lead to Contacted");
  const [[todayRow]] = await db.query(
    "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today",
  );
  const details = await action(
    "/admin/inquiries",
    "updateInquiryDetailsAction",
    {
      id: inquiryId,
      assignee: "QA Team",
      followUpAt: todayRow.today,
      quoteAmount: 24000,
    },
  );
  check(
    details.body.includes('"ok":true'),
    "admin saves assignee, due follow-up, and quote amount",
  );
  const note = await action("/admin/inquiries", "addInquiryNoteAction", {
    id: inquiryId,
    body: `Called lead ${run}; asked for a sample quote.`,
  });
  check(
    note.body.includes('"ok":true'),
    "admin adds a note to the inquiry timeline",
  );

  const duePage = await fetch(`${BASE}/admin/inquiries?f=due`, {
    headers: { Cookie: cookie },
  });
  const dueHtml = await duePage.text();
  check(
    duePage.status === 200 && dueHtml.includes(name),
    "due-today view shows the inquiry",
  );
  const dashboard = await fetch(`${BASE}/admin`, {
    headers: { Cookie: cookie },
  });
  check(
    (await dashboard.text()).includes("Inquiry follow-ups due today"),
    "dashboard includes the follow-up reminder",
  );

  const won = await action("/admin/inquiries", "updateInquiryStatusAction", {
    id: inquiryId,
    status: "won",
  });
  check(won.body.includes('"ok":true'), "admin marks the lead Won");
  const manual = await action(
    "/admin/inquiries",
    "createManualInquiryOrderAction",
    {
      inquiryId,
      name,
      phone,
      email,
      line1: "12 Test Road",
      line2: "",
      city: "Bijainagar",
      state: "Rajasthan",
      pincode: "305624",
      method: "offline",
      shipping: 50,
      items: [{ variantKey: variant.variant_key, quantity: 2, unitPrice: 123 }],
    },
  );
  check(
    manual.body.includes('"ok":true') && manual.body.includes('"orderNo"'),
    "won lead creates a manual order with custom pricing",
  );
  const [[order]] = await db.query(
    "SELECT id, source, status, payment_method, subtotal, total FROM orders WHERE email=? ORDER BY id DESC LIMIT 1",
    [email],
  );
  if (order) orderId = Number(order.id);
  check(
    order?.source === "admin" &&
      order?.status === "paid" &&
      order?.payment_method === "offline" &&
      Number(order?.subtotal) === 246 &&
      Number(order?.total) === 296,
    `manual order stores admin source, paid-offline status, custom price and shipping (${JSON.stringify(order)})`,
  );
  const [[line]] = await db.query(
    "SELECT unit_price, quantity FROM order_items WHERE order_id=?",
    [orderId],
  );
  check(
    Number(line?.unit_price) === 123 && Number(line?.quantity) === 2,
    `manual order item snapshot preserves the override (${JSON.stringify(line)})`,
  );

  const [[mail]] = await db.query(
    "SELECT COUNT(*) AS n FROM email_outbox WHERE order_id IS NULL AND template='store_new_inquiry' AND dedupe_key LIKE ?",
    [`store_new_inquiry:${inquiryId}:%`],
  );
  if (process.env.STORE_ALERT_EMAIL)
    check(Number(mail.n) > 0, "store inquiry email is queued in the outbox");
  else
    console.log(
      "SKIP  STORE_ALERT_EMAIL is not configured; no external email is sent",
    );

  const denied = await action(
    "/admin/inquiries",
    "updateInquiryStatusAction",
    { id: inquiryId, status: "lost" },
    false,
  );
  check(
    denied.status === 303 || denied.status === 307,
    "admin inquiry mutations reject requests without an admin session",
  );
} finally {
  if (orderId) await db.query("DELETE FROM orders WHERE id=?", [orderId]);
  await db.query(
    "DELETE FROM email_outbox WHERE order_id IS NULL AND template='store_new_inquiry' AND dedupe_key LIKE ?",
    [`store_new_inquiry:${inquiryId}:%`],
  );
  if (inquiryId) {
    await db.query("DELETE FROM activity_log WHERE target=?", [
      `inquiry:${inquiryId}`,
    ]);
    await db.query("DELETE FROM inquiries WHERE id=?", [inquiryId]);
  }
  await db.query("DELETE FROM addresses WHERE phone=?", [phone]);
  await db.query("DELETE FROM customers WHERE phone=?", [phone]);
  await db.end();
}
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
