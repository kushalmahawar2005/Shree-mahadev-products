// Exercise the real collection server actions and storefront with the local DB.
// Usage: pnpm test:collections http://localhost:3000
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const ROOT = process.env.TEST_MANIFEST_DIR ?? ".next/dev";
const db = await mysql.createConnection({
  host: process.env.DATABASE_HOST, port: +process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
const suffix = randomBytes(3).toString("hex");
const originalHandle = `p13-test-${suffix}`;
const renamedHandle = `${originalHandle}-renamed`;
let originalOrder = [];
let originalPositions = [];
let okay = true;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) okay = false; };
const walk = (dir) => readdirSync(dir).flatMap((file) => statSync(join(dir, file)).isDirectory() ? walk(join(dir, file)) : [join(dir, file)]);
function actionId(name) {
  for (const file of walk(ROOT).filter((file) => file.endsWith("server-reference-manifest.json"))) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, action] of Object.entries(manifest.node ?? {})) if (action.exportedName === name) return id;
  }
  throw new Error(`Action ${name} not found in ${ROOT}`);
}
async function action(name, args, cookie = "") {
  const response = await fetch(`${BASE}/admin/categories`, {
    method: "POST", redirect: "manual",
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(args),
  });
  return { status: response.status, body: await response.text() };
}
function adminCookie(username, version) {
  const payload = Buffer.from(JSON.stringify({ u: username, v: version, exp: Date.now() + 600_000 })).toString("base64url");
  return `smp_admin=${payload}.${createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url")}`;
}

try {
  const [[admin]] = await db.query("SELECT username, session_version FROM admin_users WHERE username=?", [process.env.ADMIN_USER ?? "admin"]);
  if (!admin) throw new Error("Admin account not found");
  const cookie = adminCookie(admin.username, Number(admin.session_version));
  await fetch(`${BASE}/admin/categories`, { headers: { Cookie: cookie } });
  const [productRows] = await db.query("SELECT id, handle, title FROM products WHERE status='active' ORDER BY id LIMIT 3");
  if (productRows.length < 2) throw new Error("At least two active products are required");
  const [current] = await db.query("SELECT handle, sort_order, menu_order FROM collections WHERE active=1 ORDER BY sort_order, id");
  originalOrder = current.map((r) => String(r.handle));
  originalPositions = current.map((r) => ({ handle: String(r.handle), sortOrder: Number(r.sort_order), menuOrder: Number(r.menu_order) }));

  const input = {
    handle: originalHandle, title: `Prompt 13 Test ${suffix}`, description: "Test collection description",
    imageUrl: "", seoTitle: "Test collection SEO title", seoDescription: "Test collection SEO description",
    inMenu: true, menuOrder: 1, showHomepage: true, products: productRows.slice(0, 2).map((p) => String(p.handle)),
  };
  const create = await action("saveCollectionAction", [input], cookie);
  check(create.status === 200 && create.body.length > 0, "admin creates a collection through the server action");
  let [[row]] = await db.query("SELECT title, description, seo_title, in_menu, show_homepage FROM collections WHERE handle=?", [originalHandle]);
  check(row?.title === input.title && row?.seo_title === input.seoTitle && !!row.in_menu && !!row.show_homepage, "SEO and storefront visibility settings persist");
  const [members] = await db.query("SELECT p.handle, cp.sort_order FROM collection_products cp JOIN collections c ON c.id=cp.collection_id JOIN products p ON p.id=cp.product_id WHERE c.handle=? ORDER BY cp.sort_order", [originalHandle]);
  check(members.length === 2 && Number(members[0].sort_order) === 0 && Number(members[1].sort_order) === 1, "product membership and display order persist");

  const renamed = { ...input, handle: renamedHandle, title: `${input.title} renamed`, products: [String(productRows[1].handle), String(productRows[0].handle)] };
  const update = await action("saveCollectionAction", [renamed, originalHandle], cookie);
  const [[renamedRow]] = await db.query("SELECT title, seo_title FROM collections WHERE handle=?", [renamedHandle]);
  const [renamedMembers] = await db.query("SELECT p.handle FROM collection_products cp JOIN collections c ON c.id=cp.collection_id JOIN products p ON p.id=cp.product_id WHERE c.handle=? ORDER BY cp.sort_order", [renamedHandle]);
  check(update.status === 200 && renamedRow?.title === renamed.title && renamedRow?.seo_title === renamed.seoTitle && renamedMembers[0]?.handle === renamed.products[0], "collection edits, ordered membership, and handle changes save");
  const [[redirectRow]] = await db.query("SELECT destination_path FROM redirects WHERE source_path=?", [`/collections/${originalHandle}`]);
  check(redirectRow?.destination_path === `/collections/${renamedHandle}`, "old public URL gets a permanent redirect record");
  const oldResponse = await fetch(`${BASE}/collections/${originalHandle}`, { redirect: "manual" });
  const oldLocation = oldResponse.headers.get("location");
  check(oldResponse.status === 301 && oldLocation?.endsWith(`/collections/${renamedHandle}`), `old collection URL redirects permanently (${oldResponse.status} ${oldLocation ?? "no location"})`);
  const publicResponse = await fetch(`${BASE}/collections/${renamedHandle}`);
  const publicHtml = await publicResponse.text();
  const contentStart = publicHtml.indexOf("<h1");
  const firstProductPosition = publicHtml.indexOf(productRows[1].title, contentStart);
  const secondProductPosition = publicHtml.indexOf(productRows[0].title, contentStart);
  check(publicResponse.status === 200 && publicHtml.includes(renamed.seoTitle) && firstProductPosition >= 0 && firstProductPosition < secondProductPosition, `collection page uses saved SEO metadata and product order (HTTP ${publicResponse.status}, seo ${publicHtml.includes(renamed.seoTitle)}, product positions ${firstProductPosition}/${secondProductPosition})`);
  const homeResponse = await fetch(BASE);
  const homeHtml = await homeResponse.text();
  check(homeResponse.status === 200 && homeHtml.includes(renamed.title), "homepage collection toggle adds the featured collection card");
  const adminList = await fetch(`${BASE}/admin/categories`, { headers: { Cookie: cookie } });
  const adminHtml = await adminList.text();
  check(adminHtml.includes("Collections") && adminHtml.includes(renamed.title), "collections admin workspace lists saved collections");

  const [[protectedRow]] = await db.query("SELECT handle FROM collections WHERE handle='bestsellers'");
  if (protectedRow) {
    await action("deleteCollectionAction", ["bestsellers"], cookie);
    const [[stillThere]] = await db.query("SELECT id FROM collections WHERE handle='bestsellers'");
    check(!!stillThere, "core collections cannot be deleted");
  }
  const orderTest = await action("reorderCollectionsAction", [originalOrder.concat([renamedHandle])], cookie);
  const [orderedRows] = await db.query("SELECT handle, sort_order FROM collections WHERE active=1 ORDER BY sort_order, id");
  check(orderTest.status === 200 && orderedRows.map((r) => String(r.handle)).at(-1) === renamedHandle, "collection drag order saves for all visible collections");
  const removed = await action("deleteCollectionAction", [renamedHandle], cookie);
  const [[gone]] = await db.query("SELECT id FROM collections WHERE handle=?", [renamedHandle]);
  check(removed.status === 200 && !gone, "collection delete removes the saved collection after confirmation action");
} catch (error) {
  console.error(error);
  okay = false;
} finally {
  try {
    await db.execute("DELETE FROM collections WHERE handle IN (?,?)", [originalHandle, renamedHandle]);
    await db.execute("DELETE FROM redirects WHERE source_path IN (?,?)", [`/collections/${originalHandle}`, `/collections/${renamedHandle}`]);
    for (const row of originalPositions) await db.execute("UPDATE collections SET sort_order=?, menu_order=? WHERE handle=?", [row.sortOrder, row.menuOrder, row.handle]);
    await db.end();
  } catch (e) { console.error("Cleanup failed", e); okay = false; }
}
process.exitCode = okay ? 0 : 1;
