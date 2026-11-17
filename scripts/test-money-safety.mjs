// Money-safety regression tests (refunds, shipments, cancels, PayU results).
//
//   TEST_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/smp_qa node scripts/test-money-safety.mjs
//
// Runs the REAL server code (src/lib/server/*.ts, loaded with Node's TypeScript type-stripping) against
// the database in TEST_DATABASE_URL only. Refuses to run without it, if it points at the main store DB
// from .env.local, or if the database name doesn't look like a test/QA database.
// PayU, NimbusPost, email, WhatsApp, invoices and the marketing pixel are replaced by in-process mocks:
// no network call can leave this process (fetch is blocked too).

import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module"; // registerHooks() would run in-thread; register() keeps hooks off the main thread
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ───────────── Guard: test database only ─────────────
const raw = process.env.TEST_DATABASE_URL;
if (!raw) {
  console.error("Refusing to run: set TEST_DATABASE_URL=mysql://user:pass@host:port/<test db>");
  process.exit(2);
}
const u = new URL(raw);
const test = {
  host: u.hostname || "127.0.0.1",
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  name: decodeURIComponent(u.pathname.replace(/^\//, "")),
};
const mainEnv = (() => {
  try {
    return Object.fromEntries(
      readFileSync(path.join(ROOT, ".env.local"), "utf8")
        .split(/\r?\n/)
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^(['"])(.*)\1$/, "$2")]),
    );
  } catch {
    return {};
  }
})();
const mainUrl = process.env.DATABASE_URL ?? "";
const sameAsMain =
  raw === mainUrl ||
  (test.name === mainEnv.DATABASE_NAME && test.host === (mainEnv.DATABASE_HOST ?? "127.0.0.1") && test.port === Number(mainEnv.DATABASE_PORT ?? 3306));
if (!test.name || sameAsMain) {
  console.error("Refusing to run: TEST_DATABASE_URL points at the main store database.");
  process.exit(2);
}
if (!/(?:^|[_-])(?:qa|test)(?:[_-]|$)/i.test(test.name)) {
  console.error(`Refusing to run: database "${test.name}" doesn't look like a test DB (name must contain _qa / _test).`);
  process.exit(2);
}
process.env.DATABASE_HOST = test.host;
process.env.DATABASE_PORT = String(test.port);
process.env.DATABASE_USER = test.user;
process.env.DATABASE_PASSWORD = test.password;
process.env.DATABASE_NAME = test.name;
process.env.ADMIN_SESSION_SECRET ??= "money-safety-test-secret";

// No real network, ever.
globalThis.fetch = async (url) => {
  throw new Error(`Network blocked in money-safety tests: ${String(url).slice(0, 80)}`);
};

// ───────────── Mocks (replace whole modules) ─────────────
const calls = [];
const record = (name) => (...args) => (calls.push({ name, args }), undefined);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let awbSeq = 0;
const mocks = {
  // mail / whatsapp / invoices / credit notes / marketing
  notifyOrder: record("notifyOrder"),
  queueOrderWhatsApp: async (...a) => record("queueOrderWhatsApp")(...a),
  queueOrderEmail: record("queueOrderEmail"),
  queueMarketingEvent: record("queueMarketingEvent"),
  ensureInvoiceForOrder: async () => {},
  ensureInvoiceIfApplicable: async () => {},
  ensureCreditNotesForOrder: async () => {},
  kickOutbox: () => {},
  queueSupportAlert: async () => {},
  // PayU
  verifyPayuResponse: () => true,
  verifyPaymentWithPayu: async (txnid) => (calls.push({ name: "payuVerify", args: [txnid] }), { status: "success", amount: mocks.__verifyAmount, mihpayid: `MIH${txnid}` }),
  requestPayuRefund: async (mihpayid, token, amount) => {
    calls.push({ name: "payuRefund", args: [mihpayid, token, amount] });
    await sleep(120);
    return mocks.__refundAnswer ?? { ok: true, ref: `RF${token}`, message: "Refund requested" };
  },
  // NimbusPost
  createShipment: async () => {
    calls.push({ name: "npCreate", args: [] });
    await sleep(150);
    if (mocks.__npError) throw mocks.__npError;
    awbSeq += 1;
    return { awb: `TAWB${Date.now()}${awbSeq}`, providerOrderId: `NP${awbSeq}`, courierName: "TestCourier", labelUrl: null, trackingUrl: null, pickupGenerated: true, charged: 55, expectedDelivery: null };
  },
  cancelShipment: async (awb) => (calls.push({ name: "npCancel", args: [awb] }), true),
  schedulePickup: async () => true,
};
globalThis.__moneyMocks = mocks;

const exportsOf = (file) =>
  [...readFileSync(file, "utf8").matchAll(/^export (?:async )?(function|const|let|class) ([A-Za-z0-9_]+)/gm)].map((m) => ({ kind: m[1], name: m[2] }));
const stubSource = (file) =>
  exportsOf(file)
    .map(({ kind, name }) =>
      kind === "class"
        ? `export class ${name} extends Error {}`
        : /^[A-Z_]+$/.test(name)
          ? `export const ${name} = "";`
          : `export const ${name} = (...a) => { const m = globalThis.__moneyMocks[${JSON.stringify(name)}]; return m ? m(...a) : undefined; };`,
    )
    .join("\n");
const STUBBED = ["mail", "whatsapp", "invoices", "credit-notes", "marketing", "payu", "nimbuspost"].map((n) => path.join(ROOT, "src/lib/server", `${n}.ts`));
const stubs = Object.fromEntries(STUBBED.map((f) => [pathToFileURL(f).href, stubSource(f)]));
// support-tickets is real (cancel requests create tickets) except its alert, which would message the team.
const supportFile = path.join(ROOT, "src/lib/server/support-tickets.ts");

const hooks = `
import { existsSync, statSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const ts = createRequire(${JSON.stringify(path.join(ROOT, "package.json"))})("typescript");
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = ${JSON.stringify(ROOT)};
const STUBS = ${JSON.stringify(stubs)};
const SUPPORT = ${JSON.stringify(pathToFileURL(supportFile).href)};
const isFile = (f) => existsSync(f) && statSync(f).isFile();
export async function resolve(spec, ctx, next) {
  if (spec === "server-only" || spec === "client-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  let target = null;
  if (spec.startsWith("@/")) target = path.join(ROOT, "src", spec.slice(2));
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:"))
    target = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
  if (target) {
    for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
      if (isFile(target + ext)) {
        const url = pathToFileURL(target + ext).href;
        return { url: STUBS[url] ? "stub:" + url : url, shortCircuit: true };
      }
    }
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.startsWith("stub:")) return { format: "module", source: STUBS[url.slice(5)], shortCircuit: true };
  // Project TS/TSX: full transpile (parameter properties, JSX) with the project's own TypeScript.
  if (url.startsWith("file:") && /\\.(ts|tsx)$/.test(url) && !url.includes("/node_modules/")) {
    const file = fileURLToPath(url);
    let source = readFileSync(file, "utf8");
    if (url === SUPPORT)
      source = source.replace(/export async function queueSupportAlert\\(/, "export async function __realQueueSupportAlert(") +
        "\\nexport async function queueSupportAlert(...a) { return globalThis.__moneyMocks.queueSupportAlert(...a); }";
    const out = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: false, isolatedModules: true },
    });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, ctx);
}
`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`, import.meta.url);

// ───────────── Real modules under test ─────────────
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { db } = await imp("src/lib/server/db.ts");
const orders = await imp("src/lib/server/orders.ts");
const { refundOrder } = await imp("src/lib/server/refunds.ts");
const { bookShipment, cancelOrderShipment } = await imp("src/lib/server/shipments.ts");
const { handlePayuResult } = await imp("src/lib/server/payu-process.ts");
const { customerCancelOrder, requestOrderCancel } = await imp("src/lib/server/order-cancel.ts");

// Apply pending migrations to the TEST database (same rules as scripts/db-setup.mjs).
{
  const conn = await db().getConnection();
  await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(120) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const [done] = await conn.query("SELECT name FROM schema_migrations");
  const applied = new Set(done.map((r) => r.name));
  const dir = path.join(ROOT, "sql/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split(/;\s*$/m).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await conn.query(stmt);
    await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    console.log(`(test db) applied ${file}`);
  }
  conn.release();
}

// ───────────── Fixtures ─────────────
const created = { orders: [], customers: [] };
const q = async (sql, params = []) => (await db().query(sql, params))[0];
const [variant] = await q("SELECT variant_key, stock_qty FROM product_variants WHERE stock_qty IS NOT NULL ORDER BY id LIMIT 1");
if (!variant) throw new Error("Test DB has no stock-tracked product variant; seed the QA catalog first (scripts/seed-qa-catalog.mjs).");
const VK = variant.variant_key;
const stockStart = Number(variant.stock_qty);
const stock = async () => Number((await q("SELECT stock_qty FROM product_variants WHERE variant_key=?", [VK]))[0].stock_qty);

const phone = `9${String(Date.now()).slice(-9)}`;
const cust = await q("INSERT INTO customers (phone, name) VALUES (?, 'Money Test')", [phone]);
created.customers.push(cust.insertId);

async function makeOrder({ status, method = "payu", total = 500, qty = 0, reservation = null }) {
  const token = randomBytes(16).toString("hex");
  const r = await q(
    `INSERT INTO orders (token, status, payment_method, customer_id, customer_name, phone, email, address_line1, city, state, pincode, subtotal, total)
     VALUES (?,?,?,?, 'Money Test', ?, 'money-test@example.test', '1 Test Road', 'Jaipur', 'Rajasthan', '302001', ?, ?)`,
    [token, status, method, cust.insertId, phone, total, total],
  );
  const id = r.insertId;
  await q("UPDATE orders SET order_no=? WHERE id=?", [`SMPT${id}`, id]);
  created.orders.push(id);
  if (qty && reservation) {
    // Stock already taken for this order (as createOrder / markPaid would have done).
    await q("UPDATE product_variants SET stock_qty = stock_qty - ? WHERE variant_key=?", [qty, VK]);
    await q("INSERT INTO stock_reservations (order_id, variant_key, quantity, status, expires_at) VALUES (?,?,?,?, IF(?='held', NOW() + INTERVAL 30 MINUTE, NULL))", [id, VK, qty, reservation, reservation]);
  }
  return { id, token, orderNo: `SMPT${id}` };
}
async function addPayment(orderId, { status = "initiated", amount = 500, mihpayid = null } = {}) {
  const txnid = `T${orderId}x${randomBytes(3).toString("hex")}`;
  const r = await q("INSERT INTO payments (order_id, txnid, amount, status, mihpayid) VALUES (?,?,?,?,?)", [orderId, txnid, amount, status, mihpayid]);
  return { id: r.insertId, txnid };
}
const orderRow = async (id) => (await q("SELECT status, attention FROM orders WHERE id=?", [id]))[0];
const count = (name, pred = () => true) => calls.filter((c) => c.name === name && pred(c.args)).length;
const reset = () => {
  calls.length = 0;
  mocks.__refundAnswer = undefined;
  mocks.__npError = undefined;
};

let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
};

try {
  // 1 + 7. Two concurrent full refunds: only one reaches PayU; full refund before dispatch restocks.
  {
    reset();
    const o = await makeOrder({ status: "paid", qty: 2, reservation: "committed" });
    await addPayment(o.id, { status: "success", mihpayid: "MIH-REF-1" });
    const before = await stock();
    const res = await Promise.allSettled([refundOrder(o.id, 500, "test", "admin"), refundOrder(o.id, 500, "test", "admin")]);
    const ok = res.filter((r) => r.status === "fulfilled").length;
    const [{ n: succ }] = await q("SELECT COUNT(*) n FROM refunds WHERE order_id=? AND status='success'", [o.id]);
    check(ok === 1 && count("payuRefund") === 1 && Number(succ) === 1, "two concurrent full refunds → exactly one PayU refund");
    check((await orderRow(o.id)).status === "refunded", "order is refunded");
    check((await stock()) === before + 2, "full refund before dispatch puts stock back");
    check(count("notifyOrder", (a) => a[0] === o.id && a[1] === "refund") === 1, "one refund message");
  }

  // Refund with an unclear PayU answer: stays on hold, order flagged, second refund blocked.
  {
    reset();
    const o = await makeOrder({ status: "paid" });
    await addPayment(o.id, { status: "success", mihpayid: "MIH-REF-2" });
    mocks.__refundAnswer = { ok: false, uncertain: true, message: "The operation was aborted due to timeout" };
    const first = await refundOrder(o.id, 500, "t", "admin").then(() => "ok", () => "err");
    mocks.__refundAnswer = undefined;
    const second = await refundOrder(o.id, 500, "t", "admin").then(() => "ok", (e) => e.message);
    const [{ n: reqd }] = await q("SELECT COUNT(*) n FROM refunds WHERE order_id=? AND status='requested'", [o.id]);
    check(first === "err" && Number(reqd) === 1 && !!(await orderRow(o.id)).attention, "refund timeout → kept on hold + order flagged");
    check(second !== "ok" && count("payuRefund") === 1, "refund on hold blocks a second refund");
  }

  // 2. Two concurrent shipment bookings → one AWB.
  {
    reset();
    const o = await makeOrder({ status: "cod_pending", method: "cod" });
    const opts = { weightGrams: 1000, dims: { length: 10, breadth: 10, height: 10 } };
    const res = await Promise.allSettled([bookShipment(o.id, opts), bookShipment(o.id, opts)]);
    const [{ n: live }] = await q("SELECT COUNT(*) n FROM shipments WHERE order_id=? AND status<>'cancelled'", [o.id]);
    check(res.filter((r) => r.status === "fulfilled").length === 1 && count("npCreate") === 1 && Number(live) === 1, "two concurrent bookings → one NimbusPost shipment");
    check(count("notifyOrder", (a) => a[0] === o.id && a[1] === "shipped") === 1, "one shipped message");
  }

  // Booking that times out: claim kept, order flagged, re-booking blocked.
  {
    reset();
    const o = await makeOrder({ status: "paid" });
    const err = new Error("The operation was aborted due to timeout");
    err.name = "TimeoutError";
    mocks.__npError = err;
    const opts = { weightGrams: 1000, dims: { length: 10, breadth: 10, height: 10 } };
    await bookShipment(o.id, opts).catch(() => {});
    mocks.__npError = undefined;
    const again = await bookShipment(o.id, opts).then(() => "ok", (e) => e.message);
    check(!!(await orderRow(o.id)).attention && /in progress/.test(again) && count("npCreate") === 1, "booking timeout → flagged, no second booking");
  }

  // 3. Self-cancel of a paid PayU order in confirmed / packed: blocked, request created + flagged.
  for (const status of ["confirmed", "packed"]) {
    reset();
    const o = await makeOrder({ status });
    await addPayment(o.id, { status: "success", mihpayid: `MIH-C-${status}` });
    const r = await customerCancelOrder(cust.insertId, o.id, "Ordered by mistake");
    check(!r.ok && r.canRequest && (await orderRow(o.id)).status === status, `self-cancel of paid PayU order (${status}) is blocked`);
    const t1 = await requestOrderCancel(cust.insertId, o.id, "Ordered by mistake");
    const t2 = await requestOrderCancel(cust.insertId, o.id, "Ordered by mistake");
    const [{ n }] = await q("SELECT COUNT(*) n FROM support_tickets WHERE order_id=? AND issue='cancel'", [o.id]);
    check(t1.ok && t2.ok && t1.ticketNo === t2.ticketNo && Number(n) === 1 && !!(await orderRow(o.id)).attention, `cancel request (${status}) → one ticket + order flagged`);
  }
  // COD self-cancel still works.
  {
    reset();
    const o = await makeOrder({ status: "cod_pending", method: "cod", qty: 1, reservation: "committed" });
    const before = await stock();
    const r = await customerCancelOrder(cust.insertId, o.id, "Ordered by mistake");
    check(r.ok && (await orderRow(o.id)).status === "cancelled" && (await stock()) === before + 1, "COD self-cancel still cancels + restocks");
  }

  // 4. Payment arriving for a cancelled order: flagged, no messages / invoice / pixel.
  {
    reset();
    const o = await makeOrder({ status: "cancelled" });
    const p = await addPayment(o.id);
    mocks.__verifyAmount = 500;
    const out = await handlePayuResult({ txnid: p.txnid, status: "success", amount: "500", udf1: o.token, mihpayid: "MIH-LATE", mode: "UPI" }, "webhook");
    const row = await orderRow(o.id);
    check(row.status === "cancelled" && /Extra payment/.test(row.attention ?? ""), "payment for a cancelled order → order flagged, stays cancelled");
    check(count("notifyOrder") === 0 && count("queueOrderWhatsApp") === 0 && count("queueMarketingEvent") === 0, "…and no customer message / pixel event");
    void out;
  }

  // Second attempt paid on an already-paid order: flagged as extra payment.
  {
    reset();
    const o = await makeOrder({ status: "paid" });
    await addPayment(o.id, { status: "success", mihpayid: "MIH-FIRST" });
    const p2 = await addPayment(o.id);
    await handlePayuResult({ txnid: p2.txnid, status: "success", amount: "500", udf1: o.token, mihpayid: "MIH-SECOND", mode: "UPI" }, "callback");
    check(/Extra payment/.test((await orderRow(o.id)).attention ?? "") && count("notifyOrder") === 0, "second payment on a paid order → flagged, no message");
  }

  // 5. PayU callback + webhook for the same payment at once → one set of messages.
  {
    reset();
    const o = await makeOrder({ status: "pending_payment", qty: 1, reservation: "held" });
    const p = await addPayment(o.id);
    const params = { txnid: p.txnid, status: "success", amount: "500", udf1: o.token, mihpayid: "MIH-DUP", mode: "UPI" };
    await Promise.all([handlePayuResult(params, "callback"), handlePayuResult(params, "webhook")]);
    check((await orderRow(o.id)).status === "paid", "order paid once");
    check(
      count("notifyOrder", (a) => a[1] === "payment_received") === 1 && count("queueOrderWhatsApp") === 1 && count("queueMarketingEvent") === 1,
      "callback + webhook race → one email, one WhatsApp, one pixel event",
    );
  }

  // 6. Old failed attempt must not free the stock held for a newer attempt.
  {
    reset();
    const o = await makeOrder({ status: "pending_payment", qty: 1, reservation: "held" });
    const a = await addPayment(o.id);
    const b = await addPayment(o.id);
    const before = await stock();
    await orders.markPaymentFailed(a.id, o.id, "Old attempt failed");
    const [res] = await q("SELECT status FROM stock_reservations WHERE order_id=?", [o.id]);
    check((await orderRow(o.id)).status === "pending_payment" && res.status === "held" && (await stock()) === before, "late failure of an old attempt keeps the new attempt's stock");
    await orders.markPaymentFailed(b.id, o.id, "New attempt failed");
    check((await orderRow(o.id)).status === "payment_failed" && (await stock()) === before + 1, "failure of the last open attempt releases stock");
    // A success is never downgraded.
    const c = await addPayment(o.id);
    await orders.markPaid(c.id, o.id, { mihpayid: "MIH-C", mode: "UPI" });
    await orders.markPaymentFailed(c.id, o.id, "late pending", "pending");
    const [pay] = await q("SELECT status FROM payments WHERE id=?", [c.id]);
    check(pay.status === "success", "a successful payment is never overwritten to pending/failed");
  }

  // 8. Cancelling a shipment never revives a cancelled / refunded order; in-transit can't be cancelled.
  for (const status of ["cancelled", "refunded"]) {
    reset();
    const o = await makeOrder({ status });
    await q("INSERT INTO shipments (order_id, awb, courier, status, weight_grams) VALUES (?,?,?, 'booked', 500)", [o.id, `TAWBX${o.id}`, "TestCourier"]);
    await cancelOrderShipment(o.id);
    const [s] = await q("SELECT status FROM shipments WHERE order_id=?", [o.id]);
    check((await orderRow(o.id)).status === status && s.status === "cancelled", `cancel shipment on a ${status} order → order stays ${status}`);
  }
  {
    reset();
    const o = await makeOrder({ status: "packed" });
    await q("INSERT INTO shipments (order_id, awb, courier, status, weight_grams) VALUES (?,?,?, 'booked', 500)", [o.id, `TAWBY${o.id}`, "TestCourier"]);
    await cancelOrderShipment(o.id);
    check((await orderRow(o.id)).status === "paid", "cancel shipment on a packed order → back to paid (re-bookable)");
    const o2 = await makeOrder({ status: "shipped" });
    await q("INSERT INTO shipments (order_id, awb, courier, status, weight_grams) VALUES (?,?,?, 'in_transit', 500)", [o2.id, `TAWBZ${o2.id}`, "TestCourier"]);
    const r = await cancelOrderShipment(o2.id).then(() => "ok", () => "refused");
    check(r === "refused" && count("npCancel") === 1, "in-transit shipment can't be cancelled");
  }
} finally {
  // Clean up everything this run created and put the variant's stock back.
  if (created.orders.length) {
    await q("DELETE FROM stock_reservations WHERE order_id IN (?)", [created.orders]).catch(() => {});
    await q("DELETE FROM inventory_log WHERE order_id IN (?)", [created.orders]).catch(() => {});
    await q("DELETE FROM support_tickets WHERE order_id IN (?)", [created.orders]).catch(() => {});
    await q("DELETE FROM orders WHERE id IN (?)", [created.orders]).catch((e) => console.error("cleanup orders", e.message));
  }
  if (created.customers.length) await q("DELETE FROM customers WHERE id IN (?)", [created.customers]).catch(() => {});
  await q("UPDATE product_variants SET stock_qty=? WHERE variant_key=?", [stockStart, VK]);
  await db().end();
}

console.log(failed ? `\n${failed} money-safety check(s) FAILED` : "\nAll money-safety checks passed");
process.exit(failed ? 1 : 0);
