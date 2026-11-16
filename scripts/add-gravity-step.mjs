// One-off, idempotent content updates from 2026-11-14 (run once per database, local + Hostinger):
// 1. adds the "Gravity sedimentation" step to a saved oil "How it's made" story (settings.pdp_story),
//    needed because a saved admin override replaces the code defaults;
// 2. sets the client's new groundnut oil short description;
// 3. fills the business GSTIN (from the GST certificate) if it is still empty;
// 4. adds the 4th at-home check ("Naturally thick") to the saved oil story;
// 5. sets opening stock 100 on sizes that are still untracked;
// 6. switches the store phone + WhatsApp to the client's support number 8440099585.
// 7. sets the client's groundnut "About" copy (replaces the old text and the separate process note);
// 8. best before = "10 months from packaging" on every product (shown in Product info).
// 9. links the Black Sesame photos (uploaded to Cloudinary from the client zip) if the product has none;
// 10. removes the Black Sesame 30 ml and 50 ml sizes (not sold).
// Usage: node scripts/add-gravity-step.mjs   (reads DATABASE_* from .env.local / env)
import mysql from "mysql2/promise";

try { process.loadEnvFile(".env.local"); } catch {}

const STEP = {
  title: "Gravity sedimentation",
  body: "Rested still for 10 days so the finest particles sink on their own.",
  image: "/illustrations/process/4b-gravity-settled.webp",
};

const THICK = {
  image: "/images/product-story/check-thick-v1.webp",
  icon: "pour",
  title: "Naturally thick, rich in texture",
  body: "Pour a spoonful. Traditionally wood-pressed oil is thicker and richer than refined oil, because nothing is stripped out.",
};

const db = await mysql.createConnection({ host: process.env.DATABASE_HOST, port: +(process.env.DATABASE_PORT ?? 3306), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
const GROUNDNUT_ABOUT =
  "<p>Our Wood Pressed Groundnut Oil is made from desi groundnuts sourced directly from farmers. After shelling, kernels are hand-cleaned and slowly extracted using a traditional Kolhu wood-pressed machine. The oil is cloth-filtered and left for natural gravity sedimentation for 10 days, allowing heavier particles to settle without aggressive filtration or chemical processing, helping retain its natural goodness.</p><p>With its rich aroma and nutty flavour, it's perfect for frying, roasting and everyday cooking.</p><p><strong>No additives. No preservatives. No Hexane. No chemicals.</strong></p>";
const GROUNDNUT_SHORT =
  "Crafted using traditional wood-pressing methods to retain its natural goodness, authentic flavour, and naturally occurring Vitamin E.";

try {
  const [desc] = await db.execute("UPDATE products SET short_description = ? WHERE handle = 'groundnut-oil'", [GROUNDNUT_SHORT]);
  console.log("Groundnut short description:", desc.affectedRows ? "set" : "product not found");
  const [about] = await db.execute("UPDATE products SET description_html = ?, process_note = NULL WHERE handle = 'groundnut-oil'", [GROUNDNUT_ABOUT]);
  console.log("Groundnut About (client copy):", about.affectedRows ? "set" : "product not found");
  const BLACK_SESAME_PHOTOS = [["swadeshi-mahadev/products/black-sesame-oil/1l-front", "https://res.cloudinary.com/bmqxsylj/image/upload/v1794811935/swadeshi-mahadev/products/black-sesame-oil/1l-front.jpg", "Wood-Pressed Black Sesame Oil 1 L bottle, front label", 1600, 2000, 0], ["swadeshi-mahadev/products/black-sesame-oil/1l-back", "https://res.cloudinary.com/bmqxsylj/image/upload/v1794811935/swadeshi-mahadev/products/black-sesame-oil/1l-back.jpg", "Wood-Pressed Black Sesame Oil 1 L bottle, back label", 1600, 2000, 1], ["swadeshi-mahadev/products/black-sesame-oil/500ml-front", "https://res.cloudinary.com/bmqxsylj/image/upload/v1794811936/swadeshi-mahadev/products/black-sesame-oil/500ml-front.jpg", "Wood-Pressed Black Sesame Oil 500 ml bottle, front label", 1600, 2000, 2], ["swadeshi-mahadev/products/black-sesame-oil/250ml-front", "https://res.cloudinary.com/bmqxsylj/image/upload/v1794811935/swadeshi-mahadev/products/black-sesame-oil/250ml-front.jpg", "Wood-Pressed Black Sesame Oil 250 ml bottle, front label", 1600, 2000, 3], ["swadeshi-mahadev/products/black-sesame-oil/100ml-front", "https://res.cloudinary.com/bmqxsylj/image/upload/v1794811937/swadeshi-mahadev/products/black-sesame-oil/100ml-front.jpg", "Wood-Pressed Black Sesame Oil 100 ml bottle, front label", 1600, 2000, 4]];
  const [[bsHas]] = await db.query("SELECT COUNT(*) AS n FROM product_images WHERE product_handle = 'black-sesame-oil'");
  if (!Number(bsHas.n)) {
    await db.query("INSERT INTO product_images (product_handle, public_id, url, alt, width, height, sort_order) VALUES ?", [BLACK_SESAME_PHOTOS.map((r) => ["black-sesame-oil", ...r])]);
    console.log("Black Sesame photos linked:", BLACK_SESAME_PHOTOS.length);
  } else console.log("Black Sesame photos already there.");
  // Client doesn't sell Black Sesame in 30 ml / 50 ml: remove those sizes (and their photos). A size with
  // past orders is only switched off, never deleted.
  for (const key of ["black-sesame-oil--30ml", "black-sesame-oil--50ml"]) {
    const [[used]] = await db.query("SELECT COUNT(*) AS n FROM order_items WHERE variant_key = ?", [key]);
    if (Number(used.n)) {
      await db.execute("UPDATE product_variants SET available = 0 WHERE variant_key = ?", [key]);
      continue;
    }
    for (const t of ["cart_items", "back_in_stock", "stock_reservations", "inventory_log"]) await db.execute(`DELETE FROM ${t} WHERE variant_key = ?`, [key]).catch(() => {});
    const [del] = await db.execute("DELETE FROM product_variants WHERE variant_key = ?", [key]);
    if (del.affectedRows) console.log("Removed size:", key);
  }
  await db.execute("DELETE FROM product_images WHERE product_handle = 'black-sesame-oil' AND public_id REGEXP '/(30ml|50ml)-front$'");
  const [bb] = await db.execute("UPDATE products SET shelf_life = '10 months from packaging' WHERE COALESCE(shelf_life, '') <> '10 months from packaging'");
  console.log("Best before = 10 months from packaging:", bb.affectedRows, "product(s)");
  const [gst] = await db.execute(
    "UPDATE settings SET value = JSON_SET(value, '$.gstin', '08AFPPT8337M3ZC') WHERE `key` = 'business' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(value, '$.gstin')), '') = ''",
  );
  console.log("Business GSTIN:", gst.affectedRows ? "set" : "already set (or no saved business settings)");
  const [ph] = await db.execute(
    "UPDATE settings SET value = JSON_SET(value, '$.phone', '+91-8440099585', '$.whatsapp', '918440099585') WHERE `key` = 'business'",
  );
  console.log("Store phone/WhatsApp:", ph.affectedRows ? "8440099585" : "no saved business settings (code default used)");
  // Opening stock (once per database, flag in settings): every size starts at 100. Later deploys never touch stock again.
  const [[flag]] = await db.query("SELECT 1 AS done FROM settings WHERE `key` = 'opening_stock_v1'");
  if (!flag) {
    const [all] = await db.query("SELECT variant_key, COALESCE(stock_qty, 0) AS before_qty FROM product_variants");
    await db.query("UPDATE product_variants SET stock_qty = 100");
    if (all.length)
      await db.query(
        "INSERT INTO inventory_log (variant_key, delta, stock_after, reason, note, actor) VALUES ?",
        [all.map((r) => [r.variant_key, 100 - Number(r.before_qty), 100, "restock_manual", "Opening stock", "admin"])],
      );
    await db.query("INSERT INTO settings (`key`, value) VALUES ('opening_stock_v1', JSON_OBJECT('at', NOW()))");
    console.log("Opening stock set to 100 on", all.length, "sizes");
  } else console.log("Opening stock already set earlier (left alone).");
  const [[row]] = await db.query("SELECT value FROM settings WHERE `key` = 'pdp_story'");
  if (!row) { console.log("No saved story override: code defaults already include the step."); process.exit(0); }
  const map = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
  let changed = false;
  // Fourth at-home check ("Naturally thick").
  const checks = map.oil?.checks;
  const savedThick = checks?.items?.find((c) => c.title === THICK.title);
  if (savedThick && !savedThick.image) {
    savedThick.image = THICK.image;
    changed = true;
    console.log("Home check photo set:", THICK.image);
  }
  if (checks?.items && !checks.items.some((c) => c.title === THICK.title)) {
    checks.items.push(THICK);
    checks.intro = checks.intro.replace(/^Three\b/, "Four");
    changed = true;
    console.log("Added home check:", THICK.title);
  }
  const method = map.oil?.method;
  if (method && !method.steps.some((s) => /gravity/i.test(s.title))) {
    const cloth = method.steps.findIndex((s) => /cloth/i.test(s.title));
    const at = cloth >= 0 ? cloth + 1 : Math.max(method.steps.length - 1, 0);
    if (cloth >= 0 && /settle/i.test(method.steps[cloth].body)) method.steps[cloth].body = "Strained through fine cotton cloth to catch the seed bits.";
    method.steps.splice(at, 0, STEP);
    method.intro = method.intro.replace(/^Five\b/, "Six");
    changed = true;
    console.log("Added step at position", at + 1, "→", method.steps.map((s) => s.title).join(" · "));
  }
  // Client wording (2026-11-15): "Kolhu wood pressed", "pure cotton cloth", "food-grade PET bottles".
  const WORDING = [
    [/^slow pressed$|^wood pressed$/i, "Wood pressed", "Kolhu wood pressed slowly in our kachi ghani, so the oil stays cool."],
    [/cloth/i, "Cotton cloth filtered", "Filtered through pure cotton cloth to catch the seed bits."],
    [/gravity/i, "Gravity sedimentation", STEP.body],
    [/bottled/i, "Bottled fresh", "Filled in food-grade PET bottles and sealed in small batches in Bijainagar."],
  ];
  for (const st of method?.steps ?? []) {
    const w = WORDING.find(([re]) => re.test(st.title));
    if (w && (st.title !== w[1] || st.body !== w[2])) {
      st.title = w[1];
      st.body = w[2];
      changed = true;
      console.log("Wording updated:", w[1]);
    }
  }
  if (changed) await db.query("UPDATE settings SET value = ? WHERE `key` = 'pdp_story'", [JSON.stringify(map)]);
  else console.log("Story override already up to date.");
} finally {
  await db.end();
}
