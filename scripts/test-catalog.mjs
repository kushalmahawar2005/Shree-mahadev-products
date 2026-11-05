// Product lifecycle, duplicate protection, inventory adjustments, and zero threshold checks on the QA schema.
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://127.0.0.1:3005";
if (!new URL(BASE).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/)) throw new Error("Catalog tests require a localhost app URL");
const db = await connectQaDatabase();
const tag = randomBytes(4).toString("hex");
const handle = `qa-catalog-${tag}`;
const baseSku = `QA-CATALOG-${tag}`;
let okay = true;
let originalThreshold;
let hadThreshold = false;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) okay = false; };
const walk = (dir) => readdirSync(dir).flatMap((file) => statSync(join(dir, file)).isDirectory() ? walk(join(dir, file)) : [join(dir, file)]);
const actionId = (name) => {
  const root = process.env.TEST_MANIFEST_DIR ?? ".next-qa/dev";
  for (const file of walk(root).filter((file) => file.endsWith("server-reference-manifest.json"))) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, item] of Object.entries(manifest.node ?? {})) if (item.exportedName === name) return id;
  }
  throw new Error(`Server action ${name} is missing; open /admin/products in QA first`);
};
const [[admin]] = await db.query("SELECT username,session_version FROM admin_users WHERE username=?", [process.env.ADMIN_USER ?? "qa_admin"]);
if (!admin) throw new Error("QA admin is missing; create it in the dedicated QA schema first");
const payload = Buffer.from(JSON.stringify({ u: admin.username, v: Number(admin.session_version), exp: Date.now() + 600_000 })).toString("base64url");
const cookie = `smp_admin=${payload}.${createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url")}`;
await Promise.all(["/admin/products", "/admin/products/edit", "/admin/inventory"].map((path) => fetch(`${BASE}${path}`, { headers: { Cookie: cookie } })));
const action = async (name, args, path = "/admin/products/edit") => fetch(`${BASE}${path}`, {
  method: "POST",
  headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Origin: BASE, Cookie: cookie },
  body: JSON.stringify(args),
  redirect: "manual",
});
const productInput = ({ productHandle = handle, productTitle = "QA Catalog Bottle", sku = baseSku, stock = 4, status = "draft", key } = {}) => ({
  handle: productHandle, title: productTitle, titleHi: "परीक्षण", category: "oil", shortDescription: "QA-only catalog fixture",
  descriptionHtml: "", benefits: [], bestFor: [], tags: [], faqs: [], status, collections: [],
  variants: [{ ...(key ? { key } : {}), title: "250 ml", sizeValue: 250, sizeUnit: "ml", price: 245, compareAtPrice: 290, stock, available: true, sku }],
});

try {
  const [[count]] = await db.query("SELECT COUNT(*) AS n FROM products");
  if (Number(count.n) === 0) {
    const importResult = await action("importStarterCatalogAction", [], "/admin/products");
    check(importResult.status === 200, "empty QA catalog imports the starter catalog through the admin action");
  }

  const [[beforeThresholdRow]] = await db.query("SELECT value FROM settings WHERE `key`='low_stock_threshold'");
  hadThreshold = !!beforeThresholdRow;
  if (hadThreshold) originalThreshold = beforeThresholdRow.value;

  await action("saveProductAction", [productInput()]);
  let [[created]] = await db.query("SELECT p.status,v.stock_qty,v.sku,v.variant_key FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.handle=?", [handle]);
  check(created?.status === "draft" && Number(created?.stock_qty) === 4 && created?.sku === baseSku, "product creation saves draft state, SKU, variant, and tracked stock");

  const [[existingHandleProduct]] = await db.query("SELECT title FROM products WHERE handle='groundnut-oil'");
  await action("saveProductAction", [productInput({ productHandle: "groundnut-oil", productTitle: "Must not overwrite existing" })]);
  const [[afterHandleCollision]] = await db.query("SELECT title FROM products WHERE handle='groundnut-oil'");
  check(afterHandleCollision?.title === existingHandleProduct?.title, "duplicate product handle cannot overwrite the existing catalog item");

  const [[knownSku]] = await db.query("SELECT sku FROM product_variants WHERE sku IS NOT NULL AND sku<>? LIMIT 1", [baseSku]);
  const [[skuOwnerBefore]] = await db.query("SELECT product_id FROM product_variants WHERE sku=?", [knownSku.sku]);
  await action("saveProductAction", [productInput({ productHandle: `${handle}-duplicate-sku`, sku: knownSku.sku })]);
  const [[duplicateSkuProduct]] = await db.query("SELECT id FROM products WHERE handle=?", [`${handle}-duplicate-sku`]);
  const [[skuOwnerAfter]] = await db.query("SELECT product_id FROM product_variants WHERE sku=?", [knownSku.sku]);
  check(!duplicateSkuProduct && Number(skuOwnerAfter?.product_id) === Number(skuOwnerBefore.product_id), "SKU collision rolls back the new product and preserves the original variant");

  await action("saveProductAction", [productInput({ productHandle: `${handle}-duplicate-key`, sku: `${baseSku}-2`, key: created.variant_key })]);
  const [[duplicateKeyProduct]] = await db.query("SELECT id FROM products WHERE handle=?", [`${handle}-duplicate-key`]);
  check(!duplicateKeyProduct, "a size key owned by another product cannot be moved by an edit request");

  const duplicateSizes = productInput({ productHandle: `${handle}-duplicate-size`, sku: `${baseSku}-4` });
  duplicateSizes.variants.push({ ...duplicateSizes.variants[0], title: "250ml", sku: `${baseSku}-5` });
  await action("saveProductAction", [duplicateSizes]);
  const [[duplicateSizeProduct]] = await db.query("SELECT id FROM products WHERE handle=?", [duplicateSizes.handle]);
  check(!duplicateSizeProduct, "size labels that normalize to the same variant key are rejected");

  const edited = productInput({ productTitle: "QA Catalog Bottle Updated", status: "active", stock: 6 });
  await action("saveProductAction", [edited, handle]);
  [[created]] = await db.query("SELECT p.status,p.title,v.stock_qty,v.variant_key FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.handle=?", [handle]);
  check(created?.status === "active" && created?.title === edited.title && Number(created?.stock_qty) === 6, "editing updates product details, lifecycle status, and stock");

  await action("adjustStockAction", [{ variantKey: created.variant_key, mode: "delta", value: 3, reason: "restock_manual" }], "/admin/inventory");
  let [[stock]] = await db.query("SELECT stock_qty FROM product_variants WHERE variant_key=?", [created.variant_key]);
  check(Number(stock.stock_qty) === 9, "inventory adjustment increments current stock");
  await action("adjustStockAction", [{ variantKey: created.variant_key, mode: "set", value: 2, reason: "correction" }], "/admin/inventory");
  [[stock]] = await db.query("SELECT stock_qty FROM product_variants WHERE variant_key=?", [created.variant_key]);
  const [history] = await db.query("SELECT delta,reason FROM inventory_log WHERE variant_key=? ORDER BY id DESC LIMIT 2", [created.variant_key]);
  check(Number(stock.stock_qty) === 2 && Number(history[0]?.delta) === -7 && history[0]?.reason === "correction" && history.length === 2, "exact adjustment creates audit history with reason and resulting delta");

  await action("setLowStockThresholdAction", [0], "/admin/inventory");
  const [[threshold]] = await db.query("SELECT value FROM settings WHERE `key`='low_stock_threshold'");
  check(Number(typeof threshold.value === "string" ? JSON.parse(threshold.value) : threshold.value) === 0, "low-stock threshold accepts zero");

  await action("saveProductAction", [productInput({ productTitle: "QA Catalog Bottle Updated", status: "archived", stock: 2 }), handle]);
  const [[archived]] = await db.query("SELECT status FROM products WHERE handle=?", [handle]);
  check(archived?.status === "archived", "product can move to archived status");
} catch (error) {
  console.error(error);
  okay = false;
} finally {
  try {
    if (hadThreshold) await db.execute("INSERT INTO settings (`key`,value) VALUES ('low_stock_threshold',?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [typeof originalThreshold === "string" ? originalThreshold : JSON.stringify(originalThreshold)]);
    else await db.execute("DELETE FROM settings WHERE `key`='low_stock_threshold'");
    await db.execute("DELETE FROM inventory_log WHERE variant_key LIKE ?", [`${handle}--%`]);
    await db.execute("DELETE FROM products WHERE handle LIKE ?", [`${handle}%`]);
    await db.end();
  } catch (error) { console.error("Catalog QA cleanup failed", error); okay = false; }
}

console.log(okay ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exitCode = okay ? 0 : 1;
