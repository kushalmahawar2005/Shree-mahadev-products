// PayU flow test WITHOUT real credentials (uses whatever PAYU_KEY/SALT is in .env.local, e.g. dummy values).
// Covers: hash rejection, failure callback, success that PayU can't verify (stays pending), cron auth.
// Real money paths (verify_payment success, refunds) need PayU test keys: see docs/PAYU_TEST_PLAN.md.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const { PAYU_KEY: KEY, PAYU_SALT: SALT } = process.env;
if (!KEY || !SALT) { console.error("Set PAYU_KEY and PAYU_SALT (dummy values are fine for this test)"); process.exit(1); }
const db = await mysql.createConnection({ host: process.env.DATABASE_HOST, port: +process.env.DATABASE_PORT, user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
let pass = true;
const check = (ok, m) => { console.log(`${ok ? "PASS" : "FAIL"}  ${m}`); if (!ok) pass = false; };
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const actionId = (n) => { for (const f of walk(".next/dev").filter((f) => f.endsWith("server-reference-manifest.json"))) { const m = JSON.parse(readFileSync(f, "utf8")); for (const [id, v] of Object.entries(m.node ?? {})) if (v.exportedName === n) return id; } throw new Error(n); };
const jar = new Map(); const ck = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const keep = (r) => { for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); jar.set(k, v.join("=")); } };
const sha = (s) => createHash("sha512").update(s).digest("hex");

// Place a PayU order and open the pay page (creates the payment attempt).
const r0 = await fetch(BASE + "/shop", { method: "POST", headers: { "Next-Action": actionId("addToCartAction"), "Content-Type": "text/plain;charset=UTF-8", Cookie: ck() }, body: JSON.stringify(["groundnut-oil--2l", 1]) }); keep(r0);
const html = await (await fetch(BASE + "/checkout", { headers: { Cookie: ck() } })).text();
const fd = new FormData();
for (const [k, v] of Object.entries({ "$ACTION_REF_1": "", "$ACTION_1:0": html.match(/ACTION_1:0" value="([^"]*)/)[1].replace(/&quot;/g, '"'), "$ACTION_1:1": '["$undefined"]', "$ACTION_KEY": html.match(/ACTION_KEY" value="([^"]*)/)[1], name: "Payu Test", phone: "9822233344", email: "payutest@example.com", line1: "12 Test Street", city: "Ajmer", state: "Rajasthan", pincode: "305001", method: "payu" })) fd.append(k, v);
const res = await fetch(BASE + "/checkout", { method: "POST", body: fd, headers: { Cookie: ck() }, redirect: "manual" });
const pay = await (await fetch(BASE + (res.headers.get("location") ?? "").replace(/^https?:\/\/[^/]+/, ""), { headers: { Cookie: ck() } })).text();
const field = (n) => (pay.match(new RegExp(`name="${n}" value="([^"]*)"`)) ?? [])[1];
const txnid = field("txnid"), amount = field("amount"), udf1 = field("udf1"), email = field("email"), firstname = field("firstname"), productinfo = field("productinfo");
check(!!txnid && pay.includes("test.payu.in/_payment"), `pay page posts to PayU test with txnid ${txnid}`);
const status = async () => (await db.query("SELECT p.status ps, o.status os FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.txnid = ?", [txnid]))[0][0];

const post = (path, data) => fetch(BASE + path, { method: "POST", body: new URLSearchParams(data), redirect: "manual" });
const reverse = (st) => sha([SALT, st, "", "", "", "", "", "", "", "", "", udf1, email, firstname, productinfo, amount, txnid, KEY].join("|"));
const base = { key: KEY, txnid, amount, productinfo, firstname, email, udf1, mihpayid: "403993715TEST" };

await post("/api/payu/webhook", { ...base, status: "success", hash: "deadbeef" });
let s = await status();
check(s.ps === "initiated" && s.os === "pending_payment", `forged webhook ignored (payment ${s.ps}, order ${s.os})`);

await post("/api/payu/webhook", { ...base, status: "success", hash: reverse("success") });
s = await status();
check(s.ps === "pending" && s.os === "pending_payment", `valid hash but PayU can't confirm → stays pending, not paid (payment ${s.ps})`);

const cb = await post("/api/payu/callback", { ...base, status: "failure", error_Message: "Test decline", hash: reverse("failure") });
s = await status();
check(cb.status === 303 && /\/order\?t=/.test(cb.headers.get("location") ?? ""), "failure callback redirects to the order page");
check(s.os === "payment_failed", `order marked payment_failed (got ${s.os})`);

const c1 = await fetch(BASE + "/api/cron/payu-reconcile");
const c2 = await fetch(BASE + "/api/cron/payu-reconcile", { headers: { "x-cron-secret": process.env.CRON_SECRET } });
check(c1.status === 401 && c2.status === 200, `cron route: no secret ${c1.status}, with secret ${c2.status} ${await c2.text()}`);

await db.query("DELETE FROM orders WHERE email = 'payutest@example.com'");
await db.end();
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
