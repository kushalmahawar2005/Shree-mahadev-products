// Verified buyer review workflow on the app and local test database.
// Usage: TEST_MANIFEST_DIR=.next/server pnpm test:reviews http://127.0.0.1:3001
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const ROOT = process.env.TEST_MANIFEST_DIR ?? ".next/dev";
const db = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
const run = randomBytes(3).toString("hex").toUpperCase();
const token = randomBytes(16).toString("hex");
const orderNo = `P12${run}`;
const testName = `Prompt 12 Review ${run}`;
const testIp = `198.18.${Number.parseInt(run.slice(0, 2), 16)}.${Number.parseInt(run.slice(2, 4), 16)}`;
let orderId = 0;
let reviewIds = [];
let pass = true;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) pass = false;
};
const walk = (dir) =>
  readdirSync(dir).flatMap((f) =>
    statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)],
  );
const actionId = (name) => {
  for (const file of walk(ROOT).filter((f) =>
    f.endsWith("server-reference-manifest.json"),
  )) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, action] of Object.entries(manifest.node ?? {}))
      if (action.exportedName === name) return id;
  }
  throw new Error(`Action ${name} not found in ${ROOT}`);
};
async function action(route, name, data, cookie = "") {
  const response = await fetch(`${BASE}${route}`, {
    method: "POST",
    headers: {
      "Next-Action": actionId(name),
      "Content-Type": "text/plain;charset=UTF-8",
      "x-forwarded-for": testIp,
      Origin: BASE,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify([data]),
    redirect: "manual",
  });
  return { status: response.status, body: await response.text() };
}
function adminCookie(username, version) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, v: version, exp: Date.now() + 600_000 }),
  ).toString("base64url");
  return `smp_admin=${payload}.${createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url")}`;
}

try {
  const [choices] = await db.query(
    `SELECT p.handle, p.title, v.variant_key, v.title AS variant_title, v.price, v.sku
     FROM products p JOIN product_variants v ON v.product_id=p.id
     WHERE p.status='active' AND v.available=1 AND v.stock_qty IS NULL
       AND v.id=(SELECT MIN(v2.id) FROM product_variants v2 WHERE v2.product_id=p.id AND v2.available=1 AND v2.stock_qty IS NULL)
     ORDER BY p.id LIMIT 2`,
  );
  if (!choices.length)
    throw new Error(
      "No active untracked variant available for the review test.",
    );
  const distinct = [...new Map(choices.map((p) => [p.handle, p])).values()];
  if (distinct.length < 2)
    throw new Error(
      "Two distinct active products with untracked stock are required for the review test.",
    );
  const productA = distinct[0];
  const productB = distinct[1];
  const email = `prompt12-${run.toLowerCase()}@example.test`;
  const phone = `94${String(parseInt(run, 16) % 1_000_000).padStart(6, "0")}01`;
  const total =
    Number(productA.price) +
    (productA.handle === productB.handle ? 0 : Number(productB.price));
  const [order] = await db.execute(
    `INSERT INTO orders (order_no, token, status, payment_method, customer_name, phone, email, address_line1, city, state, pincode, subtotal, total)
     VALUES (?, ?, 'delivered', 'cod', ?, ?, ?, '12 Review Test Road', 'Bijainagar', 'Rajasthan', '305624', ?, ?)`,
    [orderNo, token, testName, phone, email, total, total],
  );
  orderId = Number(order.insertId);
  for (const product of distinct)
    await db.execute(
      `INSERT INTO order_items (order_id, variant_key, product_handle, product_title, variant_title, sku, unit_price, quantity, line_total)
     VALUES (?,?,?,?,?,?,?,1,?)`,
      [
        orderId,
        product.variant_key,
        product.handle,
        product.title,
        product.variant_title,
        product.sku,
        Number(product.price),
        Number(product.price),
      ],
    );

  const reviewPage = await fetch(`${BASE}/review?t=${token}`);
  const reviewHtml = await reviewPage.text();
  check(
    reviewPage.status === 200 && reviewHtml.includes(String(productA.title)),
    "delivered order link shows only purchased products",
  );
  const submitted = await action("/review", "submitVerifiedReviewAction", {
    token,
    productHandle: String(productA.handle),
    rating: 5,
    title: "Fresh and fragrant",
    body: "The oil tastes fresh and has a lovely aroma in our cooking.",
    photos: [],
  });
  check(
    submitted.body.includes('"ok":true') &&
      submitted.body.includes('"held":false'),
    "verified review is saved pending moderation",
  );
  const [[review]] = await db.query(
    "SELECT id, status, order_id, source FROM reviews WHERE order_id=? AND product_handle=?",
    [orderId, productA.handle],
  );
  if (!review) throw new Error("The verified review row was not created.");
  reviewIds.push(Number(review.id));
  check(
    review.status === "pending" &&
      Number(review.order_id) === orderId &&
      review.source === "site",
    "review is linked to the delivered order and marked pending",
  );

  const duplicate = await action("/review", "submitVerifiedReviewAction", {
    token,
    productHandle: String(productA.handle),
    rating: 4,
    title: "Another review",
    body: "This should not be allowed twice.",
    photos: [],
  });
  check(
    duplicate.body.includes("already reviewed"),
    "one review per product per order is enforced",
  );
  const flaggedHandle = productB.handle;
  const flagged = await action("/review", "submitVerifiedReviewAction", {
    token,
    productHandle: String(flaggedHandle),
    rating: 5,
    title: "Link check",
    body: "I like this oil. Visit https://example.test for details.",
    photos: [],
  });
  check(
    flagged.body.includes('"held":true'),
    "review with a link is auto-held for moderation",
  );
  const [[flaggedRow]] = await db.query(
    "SELECT id, auto_hold_reason, status FROM reviews WHERE order_id=? AND product_handle=?",
    [orderId, flaggedHandle],
  );
  if (flaggedRow) reviewIds.push(Number(flaggedRow.id));
  check(
    flaggedRow?.status === "pending" &&
      flaggedRow?.auto_hold_reason === "Contains a link",
    "auto-hold reason is stored without publishing",
  );

  const [[admin]] = await db.query(
    "SELECT username, session_version FROM admin_users WHERE username=?",
    [process.env.ADMIN_USER ?? "admin"],
  );
  const cookie = adminCookie(admin.username, Number(admin.session_version));
  const approve = await action(
    "/admin/reviews",
    "moderateReviewAction",
    { id: Number(review.id), action: "approve" },
    cookie,
  );
  check(
    approve.body.includes('"ok":true'),
    "admin publishes the verified review",
  );
  const reply = await action(
    "/admin/reviews",
    "updateReviewReplyAction",
    {
      id: Number(review.id),
      reply: "Thank you for taking the time to share this.",
    },
    cookie,
  );
  check(reply.body.includes('"ok":true'), "admin can add a public reply");
  const feature = await action(
    "/admin/reviews",
    "featureReviewAction",
    { id: Number(review.id), featured: true },
    cookie,
  );
  check(
    feature.body.includes('"ok":true'),
    "approved review can be featured on the homepage",
  );
  const productPage = await fetch(`${BASE}/products/${productA.handle}`);
  const productHtml = await productPage.text();
  check(
    productHtml.includes("The oil tastes fresh") &&
      productHtml.includes("AggregateRating"),
    "approved review appears on product page and contributes to structured ratings",
  );
  const home = await fetch(BASE);
  check(
    (await home.text()).includes("The oil tastes fresh"),
    "featured review appears on homepage",
  );

  const imported = await action(
    "/admin/reviews",
    "importGoogleReviewAction",
    {
      productHandle: String(productA.handle),
      name: `Google ${run}`,
      city: "Ajmer",
      rating: 4,
      title: "Google source",
      body: "A real customer review imported from the public Google listing.",
      createdAt: new Date().toISOString().slice(0, 10),
    },
    cookie,
  );
  check(
    imported.body.includes('"ok":true'),
    "Google review import enters the moderation queue",
  );
  const [[google]] = await db.query(
    "SELECT id, source, order_id, status FROM reviews WHERE name=?",
    [`Google ${run}`],
  );
  if (google) reviewIds.push(Number(google.id));
  check(
    google?.source === "google" &&
      google?.order_id === null &&
      google?.status === "pending",
    "Google import is labelled and not falsely marked as verified",
  );
  const hidden = await action(
    "/admin/reviews",
    "moderateReviewAction",
    { id: Number(review.id), action: "hide" },
    cookie,
  );
  check(hidden.body.includes('"ok":true'), "admin can hide a published review");
  const denied = await action("/admin/reviews", "moderateReviewAction", {
    id: Number(review.id),
    action: "approve",
  });
  check(
    denied.status === 303 || denied.status === 307,
    "review moderation requires an admin session",
  );
} finally {
  const [rows] = await db.query(
    "SELECT id FROM reviews WHERE order_id=? OR name LIKE ?",
    [orderId, `Google ${run}`],
  );
  reviewIds.push(...rows.map((r) => Number(r.id)));
  reviewIds = [...new Set(reviewIds)];
  if (reviewIds.length)
    await db.query("DELETE FROM activity_log WHERE target IN (?)", [
      reviewIds.map((id) => `review:${id}`),
    ]);
  if (orderId)
    await db.query("DELETE FROM reviews WHERE order_id=?", [orderId]);
  await db.query("DELETE FROM reviews WHERE name=?", [`Google ${run}`]);
  if (orderId) await db.query("DELETE FROM orders WHERE id=?", [orderId]);
  await db.query("DELETE FROM rate_limits WHERE bucket IN (?)", [
    [`review:${testIp}`, `review_upload:${testIp}`],
  ]);
  await db.end();
}
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
