// One-off (client WhatsApp notes, 2026-11-19): short descriptions per oil, coconut story,
// sunflower/flaxseed benefits, "Pour a spoonful" removed from the PDP check card, WhatsApp channel link.
// Groundnut was already updated by hand and is not touched.
//   node scripts/apply-client-copy-2026-11-19.mjs [--dry]
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.local");
} catch {
  // use real env vars
}
const dry = process.argv.includes("--dry");

const SHORT = {
  "yellow-mustard-oil":
    "**Traditionally wood-pressed** to preserve its natural goodness, Omega-3, and essential fatty acids. Low in saturated fat, good for heart and cholesterol. With a mild mustard aroma and balanced flavour, it's a wholesome choice for everyday cooking.",
  "black-mustard-oil":
    "**Traditionally wood-pressed** from black mustard seeds for a bold aroma and an authentic, pungent taste. Naturally rich in Omega-3 and essential fatty acids, just like the kachi ghani sarson oil of old Indian kitchens.",
  "coconut-oil":
    "**Traditionally wood-pressed** from sulphur-free coconuts sourced from Tiptur, Karnataka. A rich natural aroma and authentic coconut flavour for cooking, hair and skin care.",
  "white-sesame-oil":
    "**Traditionally wood-pressed** from premium desi white sesame seeds sourced directly from Marwar, Rajasthan. Light, nutty and pure, ideal for everyday cooking, tadka and South Indian dishes.",
  "brown-sesame-oil":
    "**Traditionally wood-pressed** from premium desi brown sesame seeds sourced directly from farmers in Marwar, Rajasthan. A warm, toasty aroma for everyday cooking, pickles and traditional massage.",
  "black-sesame-oil":
    "**Traditionally wood-pressed** from premium jet-black sesame seeds sourced from Gujarat. Rich, dark til oil valued for massage, hair care and everyday wellness.",
  "flaxseed-oil":
    "**Traditionally wood-pressed** alsi oil, a natural plant source of Omega-3. Nourishes hair and scalp, and supports heart, digestion and skin from within. Best used raw, not for frying.",
  "sunflower-oil":
    "**Traditionally wood-pressed** sunflower oil, light and heart-friendly. Rich in natural antioxidants, MUFA, PUFA and Omega-6 that help maintain healthy cholesterol. A wholesome choice for everyday cooking.",
  "almond-oil":
    "**Traditionally wood-pressed** badam rogan for overall health and wellbeing. Nourishes hair and skin, and is gentle enough for baby massage.",
  "castor-oil":
    "**Traditionally wood-pressed** thick castor (arandi) oil for hair, dry skin and joint massage. Pure and unrefined, for external use.",
};

const BENEFITS = {
  "sunflower-oil": [
    "Heart-friendly, rich in natural antioxidants",
    "Rich in MUFA, PUFA and Omega-6",
    "Helps maintain healthy cholesterol levels",
    "Unrefined: no bleaching or deodorising",
  ],
  "flaxseed-oil": [
    "Natural plant source of Omega-3 (ALA)",
    "Nourishes hair and scalp",
    "Supports heart and digestive health",
    "Best consumed raw: salads, raita, roti",
  ],
  "coconut-oil": [
    "Sulphur-free coconuts from Tiptur, Karnataka",
    "Rich natural coconut aroma and flavour",
    "For cooking, hair and skin care",
    "Solidifies in winter (normal for pure coconut oil)",
  ],
};

const COCONUT_HTML =
  "<p>Our **Wood Pressed Coconut Oil** is made from carefully selected, organically sourced, sulphur-free coconuts from Tiptur, Karnataka. The coconuts are processed using a traditional Kolhu wood-pressed machine, where the oil is slowly extracted to preserve its natural aroma, rich coconut flavour and goodness.</p>" +
  "<p>The oil is cloth-filtered and left for **natural gravity sedimentation for 10 days,** allowing heavier particles to settle naturally without aggressive filtration or chemical processing.</p>" +
  "<p>With its naturally rich coconut aroma and authentic flavour, it's perfect for traditional Indian cooking, sautéing, baking, and everyday skin and hair care.</p>";

const CHANNEL = { label: "WhatsApp", href: "https://whatsapp.com/channel/0029VbBp1pa77qVWi7VElf3W" };

const c = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

const run = async (sql, params) => {
  if (dry) return console.log("[dry]", sql.slice(0, 60), params[params.length - 1]);
  const [r] = await c.execute(sql, params);
  if (!r.affectedRows) console.warn("no row:", params[params.length - 1]);
};

for (const [handle, text] of Object.entries(SHORT)) {
  await run("UPDATE products SET short_description = ? WHERE handle = ?", [text, handle]);
}
for (const [handle, list] of Object.entries(BENEFITS)) {
  await run("UPDATE products SET benefits = ?, benefits_text = ? WHERE handle = ?", [JSON.stringify(list), list.join("\n"), handle]);
}
await run("UPDATE products SET description_html = ? WHERE handle = ?", [COCONUT_HTML, "coconut-oil"]);

// Settings: PDP check card copy + socials.
const [rows] = await c.query("SELECT `key`, value FROM settings WHERE `key` IN ('pdp_story','socials')");
for (const row of rows) {
  const value = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
  let next = value;
  if (row.key === "pdp_story") next = JSON.parse(JSON.stringify(value).replaceAll("Pour a spoonful. ", ""));
  if (row.key === "socials" && !value.some((s) => s.href === CHANNEL.href)) next = [...value, CHANNEL];
  if (JSON.stringify(next) !== JSON.stringify(value)) {
    await run("UPDATE settings SET value = ? WHERE `key` = ?", [JSON.stringify(next), row.key]);
  }
}

await c.end();
console.log(dry ? "dry run done" : "done");
