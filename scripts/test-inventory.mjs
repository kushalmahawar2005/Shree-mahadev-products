// Inventory race test against a running dev server (pnpm dev) + local MySQL.
// Proves: two parallel checkouts for the last unit → exactly one order; PayU hold expiry releases stock;
// cancelling an order restocks it once.
// Usage: node scripts/test-inventory.mjs [baseUrl]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const VARIANT = "flaxseed-oil--500ml";
const db = await connectQaDatabase();
const stock = async () => (await db.query("SELECT stock_qty FROM product_variants WHERE variant_key = ?", [VARIANT]))[0][0].stock_qty;
const setStock = (n) => db.query("UPDATE product_variants SET stock_qty = ? WHERE variant_key = ?", [n, VARIANT]);
let pass = true;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) pass = false; };

// Server action ids from the dev manifests.
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const actionId = (name) => {
  for (const f of walk(process.env.TEST_MANIFEST_DIR ?? ".next/dev").filter((f) => f.endsWith("server-reference-manifest.json"))) {
    const m = JSON.parse(readFileSync(f, "utf8"));
    for (const [id, v] of Object.entries(m.node ?? {})) if (v.exportedName === name) return id;
  }
  throw new Error(`action ${name} not found (open the site once in dev first)`);
};

class Shopper {
  jar = new Map();
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  keep(res) { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); this.jar.set(k, v.join("=")); } }
  async action(path, id, args) {
    const res = await fetch(BASE + path, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Origin: BASE, "x-forwarded-for": "198.18.250.1", Cookie: this.cookie() }, body: JSON.stringify(args), redirect: "manual" });
    this.keep(res); return res;
  }
  async checkout(method) {
    const html = await (await fetch(BASE + "/checkout", { headers: { Cookie: this.cookie() } })).text();
    const aid = html.match(/ACTION_1:0" value="([^"]*)/)[1].replace(/&quot;/g, '"');
    const key = html.match(/ACTION_KEY" value="([^"]*)/)[1];
    const fd = new FormData();
    for (const [k, v] of Object.entries({ "$ACTION_REF_1": "", "$ACTION_1:0": aid, "$ACTION_1:1": '["$undefined"]', "$ACTION_KEY": key,
      name: "Race Test", phone: "98" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"), email: "race@example.com",
      line1: "12 Test Street", city: "Ajmer", state: "Rajasthan", pincode: "305001", method })) fd.append(k, v);
    const res = await fetch(BASE + "/checkout", { method: "POST", body: fd, headers: { Cookie: this.cookie(), Origin: BASE, "x-forwarded-for": "198.18.250.1" }, redirect: "manual" });
    const body = res.status === 200 ? await res.text() : "";
    return { placed: res.status === 303, location: res.headers.get("location"), outOfStock: /out of stock|left of/i.test(body) };
  }
}

await fetch(`${BASE}/shop`);
const ADD = actionId("addToCartAction");
const before = await stock();

// 1) Race for the last unit (COD).
await setStock(1);
const [a, b] = [new Shopper(), new Shopper()];
await a.action("/shop", ADD, [VARIANT, 1]); await b.action("/shop", ADD, [VARIANT, 1]);
const results = await Promise.all([a.checkout("cod"), b.checkout("cod")]);
const placed = results.filter((r) => r.placed).length;
if (placed !== 1) console.log("      race responses:", JSON.stringify(results));
check(placed === 1, `parallel checkout for the last unit: ${placed} order placed (expected 1)`);
check(results.some((r) => r.outOfStock), "the other shopper sees an out-of-stock message");
check((await stock()) === 0, `stock is 0 after the race (got ${await stock()})`);

// 2) PayU hold: holds stock, expiry releases it.
await setStock(1);
const c = new Shopper(); await c.action("/shop", ADD, [VARIANT, 1]);
const payu = await c.checkout("payu");
check(payu.placed && /checkout\/pay/.test(payu.location ?? ""), "PayU order created and redirected to payment");
check((await stock()) === 0, "PayU order holds the stock while paying");
const [[held]] = await db.query("SELECT order_id FROM stock_reservations WHERE variant_key = ? AND status = 'held' ORDER BY id DESC LIMIT 1", [VARIANT]);
await db.query("UPDATE stock_reservations SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE order_id = ?", [held.order_id]);
await new Promise((r) => setTimeout(r, 61_000)); // the cart sweep runs at most once a minute
const d = new Shopper(); await d.action("/shop", ADD, [VARIANT, 1]);
const after = await d.checkout("cod");
check(after.placed, "after the hold expired, the next shopper can buy the unit");
const [[o]] = await db.query("SELECT status FROM orders WHERE id = ?", [held.order_id]);
check(o.status === "payment_failed", `expired PayU order marked payment_failed (got ${o.status})`);

// 3) Cancel restocks once (idempotent).
const [[last]] = await db.query("SELECT order_id FROM stock_reservations WHERE variant_key = ? AND status = 'committed' ORDER BY id DESC LIMIT 1", [VARIANT]);
const s0 = await stock();
// Cancel twice through the real admin action (signed admin session, same format as src/lib/admin-session.ts).
const { createHmac } = await import("node:crypto");
const [[adminUser]] = await db.query("SELECT username, session_version FROM admin_users WHERE username = ?", [process.env.ADMIN_USER ?? "admin"]);
if (!adminUser) throw new Error("Configured admin user not found; run pnpm admin:create first.");
const payload = Buffer.from(JSON.stringify({ u: adminUser.username, v: adminUser.session_version, exp: Date.now() + 600_000 })).toString("base64url");
const sig = createHmac("sha256", process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD).update(payload).digest("base64url");
const admin = new Shopper(); admin.jar.set("smp_admin", `${payload}.${sig}`);
await fetch(`${BASE}/admin/orders/view?id=${last.order_id}`, { headers: { Cookie: admin.cookie() } });
const SET = actionId("setOrderStatusAction");
const r1 = await admin.action("/admin/orders/view", SET, [last.order_id, "cancelled", "race test"]);
if (r1.status !== 200) console.log("cancel action HTTP", r1.status, (await r1.text()).slice(0, 200));
await admin.action("/admin/orders/view", SET, [last.order_id, "cancelled", "race test again"]);
check((await stock()) === s0 + 1, `cancel restocks exactly once (stock ${s0} → ${await stock()})`);

// Clean up: restore stock and remove test orders.
await db.query("DELETE FROM orders WHERE email = 'race@example.com'");
await setStock(before);
await db.end();
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
