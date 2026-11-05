// Changing the free-shipping threshold in admin updates the whole site. Usage: node scripts/test-settings.mjs
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const actionId = (n) => { for (const f of walk(".next/dev").filter((f) => f.endsWith("server-reference-manifest.json"))) { const m = JSON.parse(readFileSync(f, "utf8")); for (const [id, v] of Object.entries(m.node ?? {})) if (v.exportedName === n) return id; } throw new Error(n); };
const page = (u) => fetch(BASE + u).then((r) => r.text());
import { connectQaDatabase } from "./test-db.mjs";
const db = await connectQaDatabase();
const [[adminUser]] = await db.query("SELECT username, session_version FROM admin_users WHERE username = ?", [process.env.ADMIN_USER ?? "admin"]);
if (!adminUser) throw new Error("Configured admin user not found; run pnpm admin:create first.");
const p = Buffer.from(JSON.stringify({ u: adminUser.username, v: adminUser.session_version, exp: Date.now() + 600_000 })).toString("base64url");
const cookie = `smp_admin=${p}.${createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(p).digest("base64url")}`;
const KEYS = ["business", "shipping", "announcement", "socials", "low_stock_threshold"];
const [snapshot] = await db.query("SELECT `key`, CAST(value AS CHAR) AS value FROM settings WHERE `key` IN (?)", [KEYS]);
const initial = {
  business: { legalName: "Swadeshi Mahadev Products", gstin: "", fssai: "12226047000007", fssaiExpiry: "", iso: "ISO 9001:2015", phone: "+91-9251005103", whatsapp: "919251005103", email: "info.mahadevproducts@gmail.com", supportHours: "9am–6pm", addressLine1: "12 B, New Bajrang Colony, Near Teja Chowk", city: "Bijainagar", district: "Beawar", state: "Rajasthan", postalCode: "305624" },
  shipping: { freeShippingThreshold: 999, codEnabled: true, codMaxOrder: 0, flatShippingFee: 60, flatCodFee: 0 },
  announcement: { intervalSec: 4, messages: [] },
  socials: [],
  lowStockThreshold: 5,
};
const SAVE = actionId("saveStoreSettingsAction");
const save = async (s) => (await fetch(BASE + "/admin/settings", { method: "POST", headers: { "Next-Action": SAVE, "Content-Type": "text/plain;charset=UTF-8", Cookie: cookie, Origin: BASE }, body: JSON.stringify([s]) })).text();
let pass = true; const check = (ok, m) => { console.log(`${ok ? "PASS" : "FAIL"}  ${m}`); if (!ok) pass = false; };
const changed = { ...initial, shipping: { ...initial.shipping, freeShippingThreshold: 1499 }, announcement: { ...initial.announcement, messages: [{ text: "Free shipping on orders above {threshold}", href: "", startsAt: "", endsAt: "" }] } };
const r1 = await save(changed); check(r1.includes('"ok":true'), "admin saved threshold 1499");
await new Promise((r) => setTimeout(r, 800));
const [home, faq, pdp] = await Promise.all([page("/"), page("/faq"), page("/products/groundnut-oil")]);
check(home.includes("Free shipping on orders above ₹1499"), "announcement bar shows ₹1499");
check(faq.includes("above ₹1499"), "FAQ answer shows ₹1499");
check(pdp.includes("1,499"), "product page delivery line shows ₹1,499");
const bad = await save({ ...initial, business: { ...initial.business, gstin: "WRONG" } });
check(bad.includes('"ok":false') && bad.includes("GSTIN"), "invalid GSTIN rejected by zod");
// Restore exactly what was in the DB before the test.
await db.query("DELETE FROM settings WHERE `key` IN (?)", [KEYS]);
for (const r of snapshot) await db.query("INSERT INTO settings (`key`, value) VALUES (?, ?)", [r.key, r.value]);
check(true, `restored ${snapshot.length} original settings rows`);
await save({ ...initial, ...(snapshot.length ? {} : {}) }).catch(() => {});
await db.query("DELETE FROM settings WHERE `key` IN (?)", [KEYS]);
for (const r of snapshot) await db.query("INSERT INTO settings (`key`, value) VALUES (?, ?)", [r.key, r.value]);
await db.end();
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
