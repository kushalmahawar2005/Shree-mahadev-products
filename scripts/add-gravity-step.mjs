// One-off, idempotent content updates from 2026-11-14 (run once per database, local + Hostinger):
// 1. adds the "Gravity settled" step to a saved oil "How it's made" story (settings.pdp_story),
//    needed because a saved admin override replaces the code defaults;
// 2. sets the client's new groundnut oil short description;
// 3. fills the business GSTIN (from the GST certificate) if it is still empty;
// 4. adds the 4th at-home check ("Naturally thick") to the saved oil story;
// 5. switches the store phone + WhatsApp to the client's support number 8440099585.
// Usage: node scripts/add-gravity-step.mjs   (reads DATABASE_* from .env.local / env)
import mysql from "mysql2/promise";

try { process.loadEnvFile(".env.local"); } catch {}

const STEP = {
  title: "Gravity settled",
  body: "Rested still for 10 days so the finest particles sink on their own.",
  image: "/illustrations/process/4b-gravity-settled.webp",
};

const THICK = {
  icon: "pour",
  title: "Naturally thick, rich in texture",
  body: "Pour a spoonful. Traditionally wood-pressed oil is thicker and richer than refined oil, because nothing is stripped out.",
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
  let changed = false;
  // Fourth at-home check ("Naturally thick").
  const checks = map.oil?.checks;
  if (checks?.items && !checks.items.some((c) => c.title === THICK.title)) {
    checks.items.push(THICK);
    checks.intro = checks.intro.replace(/^Three\b/, "Four");
    changed = true;
    console.log("Added home check:", THICK.title);
  }
  const method = map.oil?.method;
  if (method && !method.steps.some((s) => s.title === STEP.title)) {
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
    [/cloth/i, "Cloth filtered", "Filtered through pure cotton cloth to catch the seed bits."],
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
