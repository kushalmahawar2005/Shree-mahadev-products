// Email outbox test against the dev server: COD order → order_placed + store alert queued;
// admin cancel → cancelled queued; preview renders. Usage: node scripts/test-emails.mjs
import { createHmac } from "node:crypto";
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
let pass = true;
const check = (ok, m) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${m}`);
  if (!ok) pass = false;
};
const walk = (d) =>
  readdirSync(d).flatMap((f) =>
    statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)],
  );
const actionId = (name) => {
  for (const f of walk(ROOT).filter((f) =>
    f.endsWith("server-reference-manifest.json"),
  )) {
    const m = JSON.parse(readFileSync(f, "utf8"));
    for (const [id, v] of Object.entries(m.node ?? {}))
      if (v.exportedName === name) return id;
  }
  throw new Error(name);
};
const jar = new Map();
const ck = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const keep = (r) => {
  for (const c of r.headers.getSetCookie()) {
    const [kv] = c.split(";");
    const [k, ...v] = kv.split("=");
    jar.set(k, v.join("="));
  }
};
const act = async (path, id, args) => {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: BASE,
      "x-forwarded-for": "198.18.250.1",
      Cookie: ck(),
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  keep(r);
  return r;
};

const [[variant]] = await db.query(
  "SELECT v.variant_key FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.status='active' AND v.available=1 AND v.stock_qty IS NULL LIMIT 1",
);
if (!variant)
  throw new Error("No untracked available variant for the email test.");
const added = await act("/shop", actionId("addToCartAction"), [
  variant.variant_key,
  1,
]);
if (!ck().includes("smp_cart="))
  throw new Error(`Test cart was not created: ${await added.text()}`);
const html = await (
  await fetch(BASE + "/checkout", { headers: { Cookie: ck() } })
).text();
const fd = new FormData();
const actionMeta = html.match(/ACTION_1:0" value="([^"]*)/)?.[1];
const actionKey = html.match(/ACTION_KEY" value="([^"]*)/)?.[1];
if (!actionMeta || !actionKey)
  throw new Error(`Checkout action metadata missing: ${html.slice(0, 600)}`);
for (const [k, v] of Object.entries({
  $ACTION_REF_1: "",
  "$ACTION_1:0": actionMeta.replace(/&quot;/g, '"'),
  "$ACTION_1:1": '["$undefined"]',
  $ACTION_KEY: actionKey,
  name: "Mail Test",
  phone: "9811122233",
  email: "mailtest@example.com",
  line1: "12 Test Street",
  city: "Ajmer",
  state: "Rajasthan",
  pincode: "305001",
  method: "cod",
  couponCode: "",
}))
  fd.append(k, v);
const res = await fetch(BASE + "/checkout", {
  method: "POST",
  body: fd,
  headers: { Cookie: ck(), Origin: BASE, "x-forwarded-for": "198.18.250.1" },
  redirect: "manual",
});
check(res.status === 303, "COD order placed");
const [[o]] = await db.query(
  "SELECT id FROM orders WHERE email = 'mailtest@example.com' ORDER BY id DESC LIMIT 1",
);
await new Promise((r) => setTimeout(r, 1500));
const rows = async () =>
  (
    await db.query(
      "SELECT template, to_email, status, error FROM email_outbox WHERE order_id = ? ORDER BY id",
      [o.id],
    )
  )[0];
let r = await rows();
check(
  r.some(
    (x) =>
      x.template === "order_placed" && x.to_email === "mailtest@example.com",
  ),
  "customer 'order placed' email queued",
);
check(
  r.some((x) => x.template === "store_new_order"),
  "store alert queued",
);
console.log(
  "      status:",
  r
    .map((x) => `${x.template}=${x.status}${x.error ? ` (${x.error})` : ""}`)
    .join(", "),
);

const p = Buffer.from(
  JSON.stringify({
    u: process.env.ADMIN_USER ?? "admin",
    exp: Date.now() + 600_000,
  }),
).toString("base64url");
jar.set(
  "smp_admin",
  `${p}.${createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(p).digest("base64url")}`,
);
await act("/admin/orders/view", actionId("setOrderStatusAction"), [
  o.id,
  "cancelled",
  "email test",
]);
await new Promise((r2) => setTimeout(r2, 1500));
r = await rows();
check(
  r.some((x) => x.template === "cancelled"),
  "'cancelled' email queued on admin cancel",
);
const [[first]] = await db.query(
  "SELECT id FROM email_outbox WHERE order_id = ? ORDER BY id LIMIT 1",
  [o.id],
);
const prev = await fetch(`${BASE}/admin/emails/preview?id=${first.id}`, {
  headers: { Cookie: ck() },
});
const body = await prev.text();
check(
  prev.status === 200 && body.includes("Hi Mail"),
  "admin preview renders the stored email",
);
const noauth = await fetch(`${BASE}/admin/emails/preview?id=${first.id}`, {
  redirect: "manual",
});
check(
  noauth.status !== 200,
  `preview blocked without login (HTTP ${noauth.status})`,
);

await db.query("DELETE FROM orders WHERE email = 'mailtest@example.com'");
await db.end();
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
