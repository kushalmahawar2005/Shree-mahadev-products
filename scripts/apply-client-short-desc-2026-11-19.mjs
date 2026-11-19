// One-off (client, 2026-11-19): product short descriptions cut to a single line on the PDP.
//   node scripts/apply-client-short-desc-2026-11-19.mjs [--dry]
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.local");
} catch {
  // use real env vars
}
const dry = process.argv.includes("--dry");

const SHORT = {
  "groundnut-oil": "**Wood-pressed** groundnut oil, rich in Vitamin E and natural nutty flavour.",
  "yellow-mustard-oil": "**Wood-pressed** yellow mustard oil with Omega-3 and a mild, balanced aroma.",
  "black-mustard-oil": "**Wood-pressed** black mustard oil with a bold, pungent kachi ghani taste.",
  "black-sesame-oil": "**Wood-pressed** black til oil for massage, hair care and daily wellness.",
  "white-sesame-oil": "**Wood-pressed** white til oil from Marwar, light and nutty for daily cooking.",
  "brown-sesame-oil": "**Wood-pressed** brown til oil with a warm aroma for cooking and pickles.",
  "flaxseed-oil": "**Wood-pressed** alsi oil, a natural plant source of Omega-3. Best used raw.",
  "coconut-oil": "**Wood-pressed** sulphur-free coconut oil for cooking, hair and skin.",
  "sunflower-oil": "**Wood-pressed** sunflower oil, light and heart-friendly for everyday cooking.",
  "almond-oil": "**Wood-pressed** badam rogan for hair, skin and gentle baby massage.",
  "walnut-oil": "**Wood-pressed** akhrot oil for wellness and skin care.",
  "castor-oil": "**Wood-pressed** arandi oil for hair, dry skin and joint massage.",
};

const c = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
for (const [handle, text] of Object.entries(SHORT)) {
  if (dry) console.log(handle, text.length, text);
  else {
    const [r] = await c.execute("UPDATE products SET short_description=? WHERE handle=?", [text, handle]);
    console.log(handle, r.affectedRows ? "updated" : "NOT FOUND");
  }
}
await c.end();
