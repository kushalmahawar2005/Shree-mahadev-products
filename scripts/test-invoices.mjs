// End-to-end invoice numbering, GST place-of-supply, PDF routes, and cleanup.
// Usage: TEST_MANIFEST_DIR=.next/server pnpm test:invoices http://127.0.0.1:3001
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const db = await connectQaDatabase();
const suffix = randomBytes(3).toString("hex").toUpperCase();
const handles = [`SMP14A${suffix}`, `SMP14B${suffix}`, `SMP14C${suffix}`, `SMP14D${suffix}`, `SMP14E${suffix}`, `SMP14F${suffix}`];
const tokens = handles.map(() => randomBytes(16).toString("hex"));
const orderIds = [];
let product = null;
let originalProduct = null;
let originalBusiness;
let originalPriceSetting;
let hadBusiness = false;
let hadPriceSetting = false;
let okay = true;
const kept = [];
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) okay = false; };
function adminCookie(username, version) {
  const payload = Buffer.from(JSON.stringify({ u: username, v: version, exp: Date.now() + 600_000 })).toString("base64url");
  return `smp_admin=${payload}.${createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url")}`;
}
async function pdfResponse(path, cookie) {
  return fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
}
function decode(value) { return typeof value === "string" ? JSON.parse(value) : value; }

try {
  // Clear fixtures left by an interrupted earlier run (this prefix is reserved for this test).
  await db.execute("DELETE FROM orders WHERE order_no LIKE 'SMP14%'");
  const [[admin]] = await db.query("SELECT username, session_version FROM admin_users WHERE username=?", [process.env.ADMIN_USER ?? "admin"]);
  if (!admin) throw new Error("Admin account not found");
  const cookie = adminCookie(admin.username, Number(admin.session_version));
  const [[choice]] = await db.query("SELECT p.handle, p.title, v.variant_key, v.title AS variant_title, v.sku FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.status='active' ORDER BY p.id LIMIT 1");
  if (!choice) throw new Error("No catalog product is available for the invoice test");
  product = choice;
  const [[p]] = await db.query("SELECT hsn, gst_rate FROM products WHERE handle=?", [product.handle]);
  originalProduct = p;
  const [settings] = await db.query("SELECT `key`, value FROM settings WHERE `key` IN ('business','prices_include_gst')");
  for (const row of settings) {
    if (row.key === "business") { originalBusiness = decode(row.value); hadBusiness = true; }
    if (row.key === "prices_include_gst") { originalPriceSetting = decode(row.value); hadPriceSetting = true; }
  }
  const business = { ...(originalBusiness ?? {}), gstin: "08ABCDE1234F1Z5" };
  await db.execute("INSERT INTO settings (`key`,value) VALUES ('business',?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [JSON.stringify(business)]);
  await db.execute("INSERT INTO settings (`key`,value) VALUES ('prices_include_gst',?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [JSON.stringify(true)]);
  await db.execute("UPDATE products SET hsn='15079010', gst_rate=5.00 WHERE handle=?", [product.handle]);

  for (let i = 0; i < handles.length; i++) {
    const state = i === 1 ? "Maharashtra" : "Rajasthan";
    const orderNo = handles[i];
    const [insert] = await db.execute(
      `INSERT INTO orders (order_no,token,status,payment_method,customer_name,phone,email,address_line1,city,state,pincode,subtotal,discount,shipping,cod_fee,total)
       VALUES (?,?,?,'cod','Invoice Test Customer','9412345678','invoice-test@example.test','12 Invoice Test Road','Jaipur',?,'302001',1000,0,0,0,1000)`,
      // COD invoices are issued once dispatched (shipped); F stays undispatched.
      [orderNo, tokens[i], i === 4 ? "cancelled" : i === 5 ? "cod_pending" : "shipped", state],
    );
    orderIds.push(Number(insert.insertId));
    await db.execute(
      `INSERT INTO order_items (order_id,variant_key,product_handle,product_title,variant_title,sku,unit_price,quantity,line_total)
       VALUES (?,?,?,?,?,?,1000,1,1000)`,
      [insert.insertId, product.variant_key, product.handle, product.title, product.variant_title, product.sku],
    );
  }

  const unauthorized = await pdfResponse(`/admin/orders/invoice?id=${orderIds[0]}`);
  check(unauthorized.status === 401 || (unauthorized.status === 307 && unauthorized.headers.get("location")?.includes("/admin/login")), `admin invoice route rejects missing session (${unauthorized.status})`);
  const firstResponse = await pdfResponse(`/admin/orders/invoice?id=${orderIds[0]}`, cookie);
  const firstBuffer = Buffer.from(await firstResponse.arrayBuffer());
  let [[first]] = await db.query("SELECT invoice_no, fy, seq, snapshot FROM invoices WHERE order_id=?", [orderIds[0]]);
  let firstSnapshot = first && decode(first.snapshot);
  check(firstResponse.status === 200 && firstResponse.headers.get("content-type")?.includes("application/pdf") && firstBuffer.subarray(0, 4).toString() === "%PDF", "admin route returns a readable PDF tax invoice");
  check(firstSnapshot?.documentTitle === "Tax invoice" && firstSnapshot?.lines[0]?.taxableValue === 952.38 && firstSnapshot?.lines[0]?.cgst === 23.81 && firstSnapshot?.lines[0]?.sgst === 23.81 && firstSnapshot?.lines[0]?.igst === 0 && firstSnapshot?.placeOfSupply?.code === "08", "Rajasthan buyer receives CGST and SGST from GST-inclusive price");

  const secondResponse = await pdfResponse(`/admin/orders/invoice?id=${orderIds[1]}`, cookie);
  const secondBuffer = Buffer.from(await secondResponse.arrayBuffer());
  const [[second]] = await db.query("SELECT invoice_no, fy, seq, snapshot FROM invoices WHERE order_id=?", [orderIds[1]]);
  const secondSnapshot = second && decode(second.snapshot);
  check(secondResponse.status === 200 && secondBuffer.subarray(0, 4).toString() === "%PDF" && secondSnapshot?.lines[0]?.igst === 47.62 && secondSnapshot?.lines[0]?.cgst === 0 && secondSnapshot?.lines[0]?.sgst === 0, "out-of-state buyer receives a readable PDF with IGST only");
  check(second?.fy === first?.fy && /^\d{4}-\d{2}$/.test(first?.fy ?? "") && Number(second?.seq) === Number(first?.seq) + 1 && first?.invoice_no === `SMP/${first.fy}/${String(first.seq).padStart(6, "0")}`, "invoice numbers use SMP/YYYY-YY/NNNNNN and increment sequentially within the financial year");

  const customerResponse = await pdfResponse(`/order/invoice?t=${tokens[1]}`);
  check(customerResponse.status === 200 && (await customerResponse.headers.get("content-type"))?.includes("application/pdf"), "customer token link downloads its order invoice");
  const bulkResponse = await pdfResponse(`/admin/orders/invoice?ids=${orderIds[0]},${orderIds[1]}`, cookie);
  const bulkBuffer = Buffer.from(await bulkResponse.arrayBuffer());
  check(bulkResponse.status === 200 && bulkBuffer.subarray(0, 4).toString() === "%PDF" && bulkBuffer.length > firstBuffer.length, "bulk route merges multiple orders into one multi-page PDF");

  const invalidBulk = await pdfResponse(`/admin/orders/invoice?ids=${orderIds[3]},${orderIds[4]}`, cookie);
  const [[partial]] = await db.query("SELECT order_id FROM invoices WHERE order_id=?", [orderIds[3]]);
  check(invalidBulk.status === 409 && !partial, "invalid order in a bulk selection rolls back every new invoice in that batch");

  const undispatched = await pdfResponse(`/admin/orders/invoice?id=${orderIds[5]}`, cookie);
  const [[none]] = await db.query("SELECT order_id FROM invoices WHERE order_id=?", [orderIds[5]]);
  check(undispatched.status === 409 && !none, "COD order not yet dispatched gets no invoice (and no number is used)");

  await db.execute("UPDATE orders SET status='cancelled' WHERE id=?", [orderIds[0]]);
  const creditResponse = await pdfResponse(`/admin/orders/invoice?id=${orderIds[0]}&cn=latest`, cookie);
  const creditBuffer = Buffer.from(await creditResponse.arrayBuffer());
  const [notes] = await db.query("SELECT credit_note_no, amount, snapshot FROM credit_notes WHERE order_id=?", [orderIds[0]]);
  const note = notes[0] && decode(notes[0].snapshot);
  check(creditResponse.status === 200 && creditBuffer.subarray(0, 4).toString() === "%PDF" && notes.length === 1 && Number(notes[0].amount) === 1000
    && /^SMP\/CN\/\d{4}-\d{2}\/\d{6}$/.test(notes[0].credit_note_no) && note?.against?.invoiceNo === first?.invoice_no, "cancelled invoiced order gets one credit note against its invoice");
  await pdfResponse(`/admin/orders/invoice?id=${orderIds[0]}&cn=latest`, cookie);
  const [[again]] = await db.query("SELECT COUNT(*) AS n FROM credit_notes WHERE order_id=?", [orderIds[0]]);
  check(Number(again.n) === 1, "credit notes are idempotent");

  const noGstin = { ...business, gstin: "" };
  await db.execute("UPDATE settings SET value=? WHERE `key`='business'", [JSON.stringify(noGstin)]);
  const supplyResponse = await pdfResponse(`/admin/orders/invoice?id=${orderIds[2]}`, cookie);
  const [[supply]] = await db.query("SELECT snapshot FROM invoices WHERE order_id=?", [orderIds[2]]);
  const supplySnapshot = supply && decode(supply.snapshot);
  check(supplyResponse.status === 200 && supplySnapshot?.documentTitle === "Bill of supply" && supplySnapshot?.taxTotal === 0 && supplySnapshot?.lines[0]?.cgst === 0 && supplySnapshot?.lines[0]?.igst === 0, "missing GSTIN produces a bill of supply without tax split");

  if (process.env.KEEP_INVOICE_TEST_PDF === "1") {
    const dir = join("tmp", "pdfs"); mkdirSync(dir, { recursive: true });
    const path = join(dir, "prompt14-invoice-sample.pdf"); writeFileSync(path, firstBuffer); kept.push(path);
    console.log(`Visual sample: ${path}`);
  }
} catch (error) {
  console.error(error); okay = false;
} finally {
  try {
    if (orderIds.length) await db.execute(`DELETE FROM orders WHERE id IN (${orderIds.map(() => "?").join(",")})`, orderIds);
    await db.execute("DELETE FROM orders WHERE order_no LIKE 'SMP14%'");
    if (product && originalProduct) await db.execute("UPDATE products SET hsn=?, gst_rate=? WHERE handle=?", [originalProduct.hsn, originalProduct.gst_rate, product.handle]);
    if (hadBusiness) await db.execute("INSERT INTO settings (`key`,value) VALUES ('business',?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [JSON.stringify(originalBusiness)]);
    else await db.execute("DELETE FROM settings WHERE `key`='business'");
    if (hadPriceSetting) await db.execute("INSERT INTO settings (`key`,value) VALUES ('prices_include_gst',?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [JSON.stringify(originalPriceSetting)]);
    else await db.execute("DELETE FROM settings WHERE `key`='prices_include_gst'");
    await db.end();
  } catch (error) { console.error("Invoice test cleanup failed", error); okay = false; }
}
process.exitCode = okay ? 0 : 1;
