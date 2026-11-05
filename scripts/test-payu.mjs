// PayU callback, verification, reconciliation, and inventory checks against QA-only local mocks.
import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://127.0.0.1:3005";
if (!new URL(BASE).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/)) throw new Error("PayU QA tests require a localhost app URL");
const { PAYU_KEY: KEY, PAYU_SALT: SALT, PAYU_VERIFY_URL, CRON_SECRET } = process.env;
if (process.env.PAYU_MODE !== "test" || !KEY || !SALT || !PAYU_VERIFY_URL?.startsWith("http://127.0.0.1:3010/") || !CRON_SECRET) {
  throw new Error("PayU tests require PAYU_MODE=test, local mock credentials/endpoint, and QA CRON_SECRET");
}
const mockHealth = await fetch("http://127.0.0.1:3010/health").catch(() => null);
if (!mockHealth?.ok) throw new Error("Start the local QA provider mock on port 3010 first");
const db = await connectQaDatabase();
const VARIANT = "groundnut-oil--2l";
const testEmail = `payu-qa-${randomBytes(4).toString("hex")}@example.test`;
const testEmails = [];
const orderIds = [];
const [[originalVariant]] = await db.query("SELECT stock_qty FROM product_variants WHERE variant_key=?", [VARIANT]);
if (!originalVariant) throw new Error(`QA catalog is missing ${VARIANT}`);
const initialStock = originalVariant.stock_qty === null ? 20 : Number(originalVariant.stock_qty);
let okay = true;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) okay = false; };
const sha = (value) => createHash("sha512").update(value).digest("hex");
const walk = (dir) => readdirSync(dir).flatMap((file) => statSync(join(dir, file)).isDirectory() ? walk(join(dir, file)) : [join(dir, file)]);
const actionId = (name) => {
  const root = process.env.TEST_MANIFEST_DIR ?? ".next-qa/dev";
  for (const file of walk(root).filter((file) => file.endsWith("server-reference-manifest.json"))) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, item] of Object.entries(manifest.node ?? {})) if (item.exportedName === name) return id;
  }
  throw new Error(`Server action ${name} is missing; open the QA storefront once first`);
};

class Shopper {
  jar = new Map();
  cookie() { return [...this.jar].map(([key, value]) => `${key}=${value}`).join("; "); }
  keep(response) { for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(";"); const [key, ...value] = pair.split("="); this.jar.set(key, value.join("=")); } }
  async createPayuOrder(email) {
    await fetch(`${BASE}/shop`);
    const added = await fetch(`${BASE}/shop`, {
      method: "POST",
      headers: { "Next-Action": actionId("addToCartAction"), "Content-Type": "text/plain;charset=UTF-8", Origin: BASE, Cookie: this.cookie() },
      body: JSON.stringify([VARIANT, 1]),
    });
    this.keep(added);
    const html = await (await fetch(`${BASE}/checkout`, { headers: { Cookie: this.cookie() } })).text();
    const actionMeta = html.match(/ACTION_1:0" value="([^"]*)/)?.[1];
    const actionKey = html.match(/ACTION_KEY" value="([^"]*)/)?.[1];
    if (!actionMeta || !actionKey) throw new Error(`Checkout metadata missing: ${html.slice(0, 300)}`);
    const form = new FormData();
    for (const [key, value] of Object.entries({
      $ACTION_REF_1: "", "$ACTION_1:0": actionMeta.replace(/&quot;/g, '"'), "$ACTION_1:1": '["$undefined"]', "$ACTION_KEY": actionKey,
      name: "PayU QA", phone: "9822233344", email, line1: "12 QA Test Road", city: "Jaipur", state: "Rajasthan", pincode: "305001", method: "payu",
    })) form.append(key, value);
    const response = await fetch(`${BASE}/checkout`, { method: "POST", body: form, headers: { Cookie: this.cookie(), Origin: BASE }, redirect: "manual" });
    const location = response.headers.get("location") ?? "";
    if (response.status !== 303 || !location.includes("/checkout/pay")) throw new Error(`Could not create QA PayU order (${response.status} ${location})`);
    const payUrl = new URL(location, BASE);
    const payHtml = await (await fetch(`${BASE}${payUrl.pathname}${payUrl.search}`, { headers: { Cookie: this.cookie() } })).text();
    const field = (name) => (payHtml.match(new RegExp(`name="${name}" value="([^"]*)"`)) ?? [])[1];
    const details = Object.fromEntries(["txnid", "amount", "udf1", "email", "firstname", "productinfo", "key"].map((name) => [name, field(name)]));
    if (!details.txnid || !payHtml.includes("test.payu.in/_payment")) throw new Error("QA checkout did not produce a PayU test form");
    const [[order]] = await db.query("SELECT id FROM orders WHERE email=? ORDER BY id DESC LIMIT 1", [email]);
    if (!order) throw new Error("QA PayU order row not found");
    orderIds.push(Number(order.id));
    testEmails.push(email);
    return details;
  }
}

const reverse = (fields, status, amount = fields.amount) => sha([
  SALT, status, "", "", "", "", "", "", "", "", "", fields.udf1, fields.email,
  fields.firstname, fields.productinfo, amount, fields.txnid, KEY,
].join("|"));
const setPayuStatus = async (fields, status, amount = fields.amount) => {
  const response = await fetch("http://127.0.0.1:3010/__qa/payu", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txnid: fields.txnid, status, amount, mihpayid: `MOCK-${fields.txnid}` }),
  });
  if (!response.ok) throw new Error("Local PayU mock could not set transaction status");
};
const paymentStatus = async (txnid) => (await db.query("SELECT p.status AS payment_status,o.status AS order_status,p.order_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.txnid=?", [txnid]))[0][0];
const stock = async () => Number((await db.query("SELECT stock_qty FROM product_variants WHERE variant_key=?", [VARIANT]))[0][0].stock_qty);
const reservation = async (orderId) => (await db.query("SELECT status FROM stock_reservations WHERE order_id=? ORDER BY id DESC LIMIT 1", [orderId]))[0][0]?.status;
const post = (path, fields) => fetch(`${BASE}${path}`, { method: "POST", body: new URLSearchParams(fields), redirect: "manual" });

try {
  await db.query("UPDATE product_variants SET stock_qty=? WHERE variant_key=?", [initialStock, VARIANT]);
  const first = await new Shopper().createPayuOrder(`${testEmail.replace("@", "+pending@")}`);
  check(await stock() === initialStock - 1, "PayU checkout places a stock hold before redirecting to test.payu.in");
  await post("/api/payu/webhook", { key: KEY, txnid: first.txnid, amount: first.amount, productinfo: first.productinfo, firstname: first.firstname, email: first.email, udf1: first.udf1, status: "success", hash: "invalid-hash" });
  let state = await paymentStatus(first.txnid);
  check(state.payment_status === "initiated" && state.order_status === "pending_payment" && await reservation(state.order_id) === "held", "invalid callback hash is ignored and does not release stock");

  await setPayuStatus(first, "pending");
  await post("/api/payu/webhook", { key: KEY, txnid: first.txnid, amount: first.amount, productinfo: first.productinfo, firstname: first.firstname, email: first.email, udf1: first.udf1, status: "success", hash: reverse(first, "success") });
  state = await paymentStatus(first.txnid);
  check(state.payment_status === "pending" && state.order_status === "pending_payment" && await reservation(state.order_id) === "held", "valid success hash without PayU verify confirmation remains pending");

  await setPayuStatus(first, "success");
  const paidCallback = await post("/api/payu/callback", { key: KEY, txnid: first.txnid, amount: first.amount, productinfo: first.productinfo, firstname: first.firstname, email: first.email, udf1: first.udf1, mihpayid: `MOCK-${first.txnid}`, status: "success", hash: reverse(first, "success") });
  state = await paymentStatus(first.txnid);
  check(paidCallback.status === 303 && state.payment_status === "success" && state.order_status === "paid" && await reservation(state.order_id) === "committed", "verified PayU success pays the order and commits reserved stock");
  const paidStock = await stock();
  await post("/api/payu/webhook", { key: KEY, txnid: first.txnid, amount: first.amount, productinfo: first.productinfo, firstname: first.firstname, email: first.email, udf1: first.udf1, mihpayid: `MOCK-${first.txnid}`, status: "success", hash: reverse(first, "success") });
  state = await paymentStatus(first.txnid);
  check(state.payment_status === "success" && await stock() === paidStock, "duplicate verified callback is idempotent");

  const wrongAmount = await new Shopper().createPayuOrder(`${testEmail.replace("@", "+amount@")}`);
  const changedAmount = (Number(wrongAmount.amount) + 1).toFixed(2);
  await post("/api/payu/webhook", { key: KEY, txnid: wrongAmount.txnid, amount: changedAmount, productinfo: wrongAmount.productinfo, firstname: wrongAmount.firstname, email: wrongAmount.email, udf1: wrongAmount.udf1, status: "success", hash: reverse(wrongAmount, "success", changedAmount) });
  state = await paymentStatus(wrongAmount.txnid);
  check(state.order_status === "payment_failed" && await reservation(state.order_id) === "released", "amount mismatch cannot mark order paid and releases its hold");

  const failure = await new Shopper().createPayuOrder(`${testEmail.replace("@", "+failure@")}`);
  await post("/api/payu/callback", { key: KEY, txnid: failure.txnid, amount: failure.amount, productinfo: failure.productinfo, firstname: failure.firstname, email: failure.email, udf1: failure.udf1, status: "failure", error_Message: "QA decline", hash: reverse(failure, "failure") });
  state = await paymentStatus(failure.txnid);
  check(state.order_status === "payment_failed" && await reservation(state.order_id) === "released", "failure callback releases reserved stock exactly once");

  const reconcile = await new Shopper().createPayuOrder(`${testEmail.replace("@", "+reconcile@")}`);
  const reconcileState = await paymentStatus(reconcile.txnid);
  await db.execute("UPDATE payments SET created_at=NOW()-INTERVAL 20 MINUTE WHERE txnid=?", [reconcile.txnid]);
  await setPayuStatus(reconcile, "success");
  const noSecret = await fetch(`${BASE}/api/cron/payu-reconcile`);
  const withSecret = await fetch(`${BASE}/api/cron/payu-reconcile`, { headers: { "x-cron-secret": CRON_SECRET } });
  state = await paymentStatus(reconcile.txnid);
  check(noSecret.status === 401 && withSecret.status === 200, "PayU reconciliation cron requires the shared secret");
  check(state.order_status === "paid" && await reservation(reconcileState.order_id) === "committed", "reconciliation confirms old verified payment and commits stock");
} catch (error) {
  console.error(error);
  okay = false;
} finally {
  try {
    if (orderIds.length) {
      await db.query("DELETE FROM inventory_log WHERE order_id IN (?)", [orderIds]);
      await db.query("DELETE FROM orders WHERE id IN (?)", [orderIds]);
    }
    await db.query("UPDATE product_variants SET stock_qty=? WHERE variant_key=?", [originalVariant.stock_qty, VARIANT]);
    await db.end();
  } catch (error) { console.error("PayU QA cleanup failed", error); okay = false; }
}

console.log(okay ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exitCode = okay ? 0 : 1;
