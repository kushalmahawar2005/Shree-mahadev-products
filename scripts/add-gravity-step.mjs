// One-off, idempotent content updates from 2026-11-14 (run once per database, local + Hostinger):
// 1. adds the "Gravity settled" step to a saved oil "How it's made" story (settings.pdp_story),
//    needed because a saved admin override replaces the code defaults;
// 2. sets the client's new groundnut oil short description;
// 3. fills the business GSTIN (from the GST certificate) if it is still empty;
// 4. switches the store phone + WhatsApp to the client's support number 8440099585.
// Usage: node scripts/add-gravity-step.mjs   (reads DATABASE_* from .env.local / env)
import mysql from "mysql2/promise";

try { process.loadEnvFile(".env.local"); } catch {}

const STEP = {
  title: "Gravity settled",
  body: "Rested still for 10 days so the finest particles sink on their own.",
  image: "/illustrations/process/4b-gravity-settled.webp",
};

const db = await mysql.createConnection({ host: process.env.DATABASE_HOST, port: +(process.env.DATABASE_PORT ?? 3306), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
const GROUNDNUT_SHORT =
  "Crafted using traditional wood-pressing methods to retain its natural goodness, authentic flavour, and naturally occurring Vitamin E.";

try {
  const [desc] = await db.execute("UPDATE products SET short_description = ? WHERE handle = 'groundnut-oil'", [GROUNDNUT_SHORT]);
  console.log("Groundnut short description:", desc.affectedRows ? "set" : "product not found");
  const [gst] = await db.execute(
    "UPDATE settings SET value = JSON_SET(value, '$.gstin', '08AFPPT8337M3ZC') WHERE `key` = 'business' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(value, '$.gstin')), '') = ''",
  );
  console.log("Business GSTIN:", gst.affectedRows ? "set" : "already set (or no saved business settings)");
  const [ph] = await db.execute(
    "UPDATE settings SET value = JSON_SET(value, '$.phone', '+91-8440099585', '$.whatsapp', '918440099585') WHERE `key` = 'business'",
  );
  console.log("Store phone/WhatsApp:", ph.affectedRows ? "8440099585" : "no saved business settings (code default used)");
  const [[row]] = await db.query("SELECT value FROM settings WHERE `key` = 'pdp_story'");
  if (!row) { console.log("No saved story override: code defaults already include the step."); process.exit(0); }
  const map = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
  const method = map.oil?.method;
  if (!method) { console.log("Oil story has no saved method: code defaults apply."); process.exit(0); }
  if (method.steps.some((s) => s.title === STEP.title)) { console.log("Already present."); process.exit(0); }

  const cloth = method.steps.findIndex((s) => /cloth/i.test(s.title));
  const at = cloth >= 0 ? cloth + 1 : Math.max(method.steps.length - 1, 0);
  if (cloth >= 0 && /settle/i.test(method.steps[cloth].body)) method.steps[cloth].body = "Strained through fine cotton cloth to catch the seed bits.";
  method.steps.splice(at, 0, STEP);
  method.intro = method.intro.replace(/^Five\b/, "Six");

  await db.query("UPDATE settings SET value = ? WHERE `key` = 'pdp_story'", [JSON.stringify(map)]);
  console.log("Added at position", at + 1, "→", method.steps.map((s) => s.title).join(" · "));
} finally {
  await db.end();
}
