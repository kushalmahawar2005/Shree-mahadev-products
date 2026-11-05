// Coupon validation against the running app and the test database only.
// Usage: TEST_MANIFEST_DIR=.next/server pnpm test:coupons http://127.0.0.1:3001
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const ROOT = process.env.TEST_MANIFEST_DIR ?? ".next/dev";
const db = await connectQaDatabase();
const suffix = randomBytes(3).toString("hex").toUpperCase();
const testIp = `198.18.${Number.parseInt(suffix.slice(0, 2), 16)}.${Number.parseInt(suffix.slice(2, 4), 16)}`;
const codes = ["CAP", "MIN", "EXP", "FIRST", "PHONE", "SHIP"].map(
  (prefix) => `${prefix}${suffix}`,
);
const adminCode = `ADMIN${suffix}`;
const phone = `95${String(parseInt(suffix, 16) % 1_000_000).padStart(6, "0")}01`;
const previousPhone = `95${String(parseInt(suffix, 16) % 1_000_000).padStart(6, "0")}02`;
const email = `prompt11-${suffix.toLowerCase()}@example.test`;
const orderToken = randomBytes(16).toString("hex");
let previousOrderId = 0;
let cartDbToken = "";
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
  for (const file of walk(ROOT).filter((path) =>
    path.endsWith("server-reference-manifest.json"),
  )) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, action] of Object.entries(manifest.node ?? {}))
      if (action.exportedName === name) return id;
  }
  throw new Error(`Action ${name} not found in ${ROOT}`);
};
const jar = new Map();
const cookie = () =>
  [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
const keep = (response) => {
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(";");
    const [key, ...parts] = pair.split("=");
    jar.set(key, parts.join("="));
  }
};
async function invoke(route, name, args) {
  const response = await fetch(`${BASE}${route}`, {
    method: "POST",
    headers: {
      "Next-Action": actionId(name),
      "Content-Type": "text/plain;charset=UTF-8",
      Cookie: cookie(),
      "x-forwarded-for": testIp,
      Origin: BASE,
    },
    body: JSON.stringify(Array.isArray(args) ? args : [args]),
    redirect: "manual",
  });
  keep(response);
  return response.text();
}
function adminCookie(username, version) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, v: version, exp: Date.now() + 600_000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `smp_admin=${payload}.${signature}`;
}

try {
  const [[variant]] = await db.query(
    "SELECT v.variant_key, v.price FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.status='active' AND v.available=1 AND v.stock_qty IS NULL LIMIT 1",
  );
  if (!variant)
    throw new Error(
      "No available untracked variant for coupon validation test.",
    );
  const cartResponse = await invoke("/shop", "addToCartAction", [
    variant.variant_key,
    3,
  ]);
  check(
    cartResponse.includes("product"),
    "test cart created without reserving stock",
  );
  cartDbToken = jar.get("smp_cid") ?? "";
  const subtotal = Number(variant.price) * 3;
  const [couponRows] = await db.query(
    "INSERT INTO coupons (code, kind, value, min_subtotal, max_discount, first_order_only, usage_limit, per_phone_limit, ends_at, active) VALUES (?, 'percent', 30, 0, 100, 0, NULL, NULL, NULL, 1), (?, 'flat', 10, ?, NULL, 0, NULL, NULL, NULL, 1), (?, 'percent', 10, 0, NULL, 0, NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY), 1), (?, 'percent', 10, 0, NULL, 1, NULL, NULL, NULL, 1), (?, 'flat', 20, 0, NULL, 0, NULL, 1, NULL, 1), (?, 'free_shipping', 0, 0, NULL, 0, NULL, NULL, NULL, 1)",
    [codes[0], codes[1], subtotal + 1, ...codes.slice(2)],
  );
  void couponRows;
  const [order] = await db.execute(
    "INSERT INTO orders (token, status, payment_method, customer_name, phone, email, address_line1, city, state, pincode, subtotal, shipping, total) VALUES (?, 'paid', 'payu', 'Prompt 11 Previous', ?, ?, 'Test road', 'Ajmer', 'Rajasthan', '305001', 100, 0, 100)",
    [orderToken, previousPhone, email],
  );
  previousOrderId = Number(order.insertId);
  const [[perPhoneCoupon]] = await db.query(
    "SELECT id FROM coupons WHERE code=?",
    [codes[4]],
  );
  await db.execute(
    "INSERT INTO coupon_redemptions (coupon_id, order_id, phone, amount) VALUES (?,?,?,20)",
    [perPhoneCoupon.id, previousOrderId, phone],
  );

  const validate = (code, customerPhone = phone) =>
    invoke("/checkout", "validateCheckoutCouponAction", {
      code,
      phone: customerPhone,
    });
  const cap = await validate(codes[0]);
  check(
    cap.includes('"ok":true') && cap.includes('"discount":100'),
    "percentage offer respects its maximum discount",
  );
  const minimum = await validate(codes[1]);
  check(
    minimum.includes(`₹${subtotal + 1} minimum order`),
    "minimum-order error shows the exact threshold",
  );
  const expired = await validate(codes[2]);
  check(
    expired.includes("invalid or has expired"),
    "expired coupon is rejected",
  );
  const first = await validate(codes[3], previousPhone);
  check(
    first.includes("first orders only"),
    "first-order-only coupon checks the customer's phone",
  );
  const perPhone = await validate(codes[4]);
  check(
    perPhone.includes("maximum number of times"),
    "per-phone redemption limit is enforced",
  );
  const shipping = await validate(codes[5]);
  check(
    shipping.includes('"ok":true') && shipping.includes('"freeShipping":true'),
    "free-shipping coupon validates without a monetary discount",
  );

  const [[admin]] = await db.query(
    "SELECT username, session_version FROM admin_users WHERE username=?",
    [process.env.ADMIN_USER ?? "admin"],
  );
  const adminResponse = await fetch(`${BASE}/admin/discounts`, {
    method: "POST",
    headers: {
      "Next-Action": actionId("saveCouponAction"),
      "Content-Type": "text/plain;charset=UTF-8",
      Cookie: adminCookie(admin.username, Number(admin.session_version)),
      Origin: BASE,
    },
    body: JSON.stringify([
      {
        id: null,
        code: adminCode,
        kind: "percent",
        value: 20,
        minSubtotal: 500,
        maxDiscount: 300,
        firstOrderOnly: false,
        usageLimit: 50,
        perPhoneLimit: 2,
        startsAt: "",
        endsAt: "",
        active: true,
        targets: [],
      },
    ]),
  });
  const adminBody = await adminResponse.text();
  check(
    adminBody.includes('"ok":true'),
    "admin creates a coupon with caps and per-phone limits",
  );

  const checkout = await fetch(`${BASE}/checkout`, {
    headers: { Cookie: cookie(), "x-forwarded-for": testIp, Origin: BASE },
  });
  const html = await checkout.text();
  const fd = new FormData();
  const actionMeta = html.match(/ACTION_1:0" value="([^"]*)/)?.[1];
  const actionKey = html.match(/ACTION_KEY" value="([^"]*)/)?.[1];
  if (!actionMeta || !actionKey)
    throw new Error("Checkout form action metadata not found.");
  for (const [key, value] of Object.entries({
    $ACTION_REF_1: "",
    "$ACTION_1:0": actionMeta.replace(/&quot;/g, '"'),
    "$ACTION_1:1": '["$undefined"]',
    $ACTION_KEY: actionKey,
    name: "Prompt 11 Coupon Test",
    phone,
    email,
    line1: "12 Test Street",
    line2: "",
    city: "Ajmer",
    state: "Rajasthan",
    pincode: "305624",
    method: "cod",
    couponCode: codes[0],
  }))
    fd.append(key, value);
  const placed = await fetch(`${BASE}/checkout`, {
    method: "POST",
    body: fd,
    headers: { Cookie: cookie(), "x-forwarded-for": testIp, Origin: BASE },
    redirect: "manual",
  });
  const [[placedOrder]] = await db.query(
    "SELECT id, status, subtotal, discount, coupon_code, shipping, cod_fee, total FROM orders WHERE phone=? ORDER BY id DESC LIMIT 1",
    [phone],
  );
  check(
    placed.status === 303 &&
      placedOrder?.status === "cod_pending" &&
      Number(placedOrder.discount) === 100 &&
      placedOrder.coupon_code === codes[0] &&
      Number(placedOrder.total) ===
        Number(placedOrder.subtotal) -
          100 +
          Number(placedOrder.shipping) +
          Number(placedOrder.cod_fee),
    `COD order stores the server-repriced discount and final total (${JSON.stringify({ status: placed.status, location: placed.headers.get("location"), order: placedOrder })})`,
  );
  if (placedOrder) {
    const [[redemption]] = await db.query(
      "SELECT COUNT(*) AS n FROM coupon_redemptions WHERE order_id=?",
      [placedOrder.id],
    );
    const [[usage]] = await db.query(
      "SELECT used_count FROM coupons WHERE code=?",
      [codes[0]],
    );
    check(
      Number(redemption.n) === 1 && Number(usage.used_count) === 1,
      "COD placement records the redemption in the order transaction",
    );
  }
  const [[stats]] = await db.query(
    "SELECT COUNT(*) AS n FROM coupons WHERE code IN (?)",
    [[...codes, adminCode]],
  );
  check(
    Number(stats.n) === codes.length + 1,
    "test coupons were isolated in the database",
  );
} finally {
  const [[created]] = await db.query(
    "SELECT id FROM orders WHERE phone=? AND email=? ORDER BY id DESC LIMIT 1",
    [phone, email],
  );
  if (created)
    await db.query("DELETE FROM email_outbox WHERE order_id=?", [created.id]);
  await db.query("DELETE FROM orders WHERE email=? OR id=?", [
    email,
    previousOrderId || 0,
  ]);
  const [[adminCoupon]] = await db.query(
    "SELECT id FROM coupons WHERE code=?",
    [adminCode],
  );
  if (adminCoupon)
    await db.query("DELETE FROM activity_log WHERE target=?", [
      `coupon:${adminCoupon.id}`,
    ]);
  await db.query("DELETE FROM coupons WHERE code IN (?)", [
    [...codes, adminCode],
  ]);
  await db.query("DELETE FROM rate_limits WHERE bucket=?", [
    `coupon:${testIp}`,
  ]);
  if (cartDbToken)
    await db.query("DELETE FROM carts WHERE token=? AND order_id IS NULL", [
      cartDbToken,
    ]);
  await db.query("DELETE FROM addresses WHERE phone IN (?)", [
    [phone, previousPhone],
  ]);
  await db.query("DELETE FROM customers WHERE phone IN (?)", [
    [phone, previousPhone],
  ]);
  await db.end();
}
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
