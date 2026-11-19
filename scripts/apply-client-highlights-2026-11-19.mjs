// One-off (client feedback, 2026-11-19): Highlights = the key health/nutrition points (what was in
// Benefits), Benefits = taste, texture, sourcing and care. No line repeats across Highlights, Benefits,
// How to use or the trust strip (wood pressed / no heat / cloth filter / lab tested). Usage and cooking
// lines live only in How to use.
//   node scripts/apply-client-highlights-2026-11-19.mjs [--dry]
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.local");
} catch {
  // use real env vars
}
const dry = process.argv.includes("--dry");

// handle: [highlights, benefits, howToUse | null (keep current)]
const COPY = {
  "groundnut-oil": [
    ["Naturally rich in Vitamin E", "Heart-friendly monounsaturated fats", "Free from trans fats", "Good source of Omega-6 fatty acids"],
    ["Natural nutty aroma and authentic groundnut taste", "High smoke point, stays stable for deep frying", "Desi groundnuts sourced directly from farmers"],
    null,
  ],
  "yellow-mustard-oil": [
    ["Rich in Omega-3 and Omega-6 fatty acids", "Heart-friendly unsaturated fats", "Good source of MUFA", "Low in saturated fat"],
    ["Natural mustard aroma, milder than black mustard", "Bright golden colour", "Traditionally keeps achaar fresh for longer"],
    null,
  ],
  "sunflower-oil": [
    ["Heart-friendly, rich in natural antioxidants", "Rich in MUFA, PUFA and Omega-6", "Helps maintain healthy cholesterol", "Natural source of Vitamin E"],
    ["Light, mild taste that lets the food's own flavour come through", "Clean, pale golden finish", "Suits the whole family, from kids to elders"],
    "Use for everyday sabzi, dal, parathas, sautéing and baking. Its light taste suits both Indian and continental dishes.",
  ],
  "white-sesame-oil": [
    ["Good fats for a healthy heart", "Natural antioxidant sesamin", "Light and easy for everyday meals", "Desi white sesame from Marwar, Rajasthan"],
    ["Light, mild til flavour", "Clear, light colour", "Also used traditionally for body massage"],
    "Ideal for everyday cooking, South Indian dishes, chutneys, tadka and salad dressings.",
  ],
  "brown-sesame-oil": [
    ["Rich in sesamol, which keeps the oil naturally stable", "Good source of Vitamin E", "A warming oil, ideal in winter", "Desi brown sesame from farmers in Marwar, Rajasthan"],
    ["Warm, toasty til aroma", "Deeper flavour than white til oil", "A traditional choice for winter body massage"],
    "Use for daily cooking, pickles, chutneys and til-based sweets. For massage, warm slightly and apply.",
  ],
  "coconut-oil": [
    ["Naturally rich in medium-chain fatty acids (MCTs)", "Contains lauric acid", "Nourishes hair and moisturises skin", "Sulphur-free coconuts from Tiptur, Karnataka"],
    ["Rich natural coconut aroma and flavour", "Turns solid in winter, a sign of pure coconut oil", "A favourite for traditional baby malish"],
    "Use for South Indian cooking, sautéing and baking. For hair and skin, warm slightly and massage gently. If it has set in winter, keep the bottle in warm water for a few minutes.",
  ],
  "black-mustard-oil": [
    ["Rich in Omega-3 and essential fatty acids", "Supports healthy circulation in cold weather", "Natural pungent compounds give its sharp kick", "A warming oil, traditional in winter"],
    ["Bold aroma and a stronger taste than yellow mustard", "Darker colour from black mustard seeds", "Traditional choice for winter body massage", "No added flavour or colour"],
    "Heat to smoking point, then lower the flame before adding spices; this mellows the raw pungency. Ideal for achaar, tadka, sabzi and Bengali-style cooking.",
  ],
  "almond-oil": [
    ["Packed with Vitamin E for hair and skin", "Rich in healthy monounsaturated fats", "Nourishes hair, skin and scalp", "Supports overall health and wellbeing"],
    ["Light, non-sticky texture that absorbs easily", "Gentle enough for baby massage", "Mild, natural almond aroma"],
    "Massage a few drops into skin or scalp. For babies, warm slightly and massage gently.",
  ],
  "walnut-oil": [
    ["Plant source of Omega-3 (ALA)", "Natural antioxidants", "Nourishes skin and hair", "Supports overall wellness"],
    ["Rich, nutty aroma", "Light golden colour", "Pressed in small batches from quality walnuts"],
    "Massage a few drops into skin or scalp, or drizzle over salads and finished dishes. Do not heat.",
  ],
  "flaxseed-oil": [
    ["Natural plant source of Omega-3 (ALA)", "Supports heart health", "Supports healthy digestion", "Nourishes hair and scalp"],
    ["Fresh, nutty and slightly earthy taste", "Slow wood pressing protects its delicate Omega-3", "A natural vegetarian alternative to fish oil"],
    "Take 1 teaspoon a day, or drizzle over salads, raita and roti after cooking. Do not heat or fry. Refrigerate after opening.",
  ],
  "castor-oil": [
    ["Rich in ricinoleic acid", "Nourishes hair, brows and lashes", "Soothes dry, rough skin", "Traditional for joint massage"],
    ["Thick, rich texture", "Pure and unrefined, nothing added", "For external use only"],
    "Warm slightly and massage into scalp, dry skin or joints. Leave on for an hour or overnight, then wash. For brows and lashes, apply a little with a clean brush at night.",
  ],
  "black-sesame-oil": [
    ["Black til, the most valued til for wellness", "Natural antioxidants sesamol and sesamin", "Deeply nourishes dry hair and scalp", "Jet-black sesame seeds from Gujarat"],
    ["Traditionally used for abhyanga (self-massage)", "Used for oil pulling (gandusha)", "Thicker and darker than other til oils"],
    null,
  ],
  "desi-khand": [
    ["Unrefined, no bleaching", "Keeps the natural minerals of sugarcane", "Sulphur-free", "Mild caramel taste"],
    ["Made the old-fashioned way from sugarcane juice", "Free-flowing, light brown grains", "No preservatives or additives"],
    "Use in place of white sugar, in the same quantity, in tea, coffee, milk, desserts and sweets.",
  ],
  "jaggery-powder": [
    ["Rich natural source of iron", "Dissolves instantly", "Made without chemicals or bleach", "Earthy molasses taste"],
    ["Fine, free-flowing powder", "No grating or breaking a block", "Made from pure sugarcane juice"],
    "Stir into tea, milk or kadha, or use in laddoo, halwa and desserts in place of sugar.",
  ],
  "jamun-raw-honey": [
    ["Raw and unheated", "Less sweet, with a tangy finish", "Dark, mineral-rich honey", "Natural enzymes intact"],
    ["Collected from jamun blossoms in season", "Thick, dark texture", "Crystallises over time; warm the jar gently to soften"],
    null,
  ],
  "sunderban-raw-honey": [
    ["Wild honey from the Sunderban mangroves", "Raw and unprocessed, straight from wild hives", "Naturally multi-floral", "Natural antioxidants intact"],
    ["Flavour changes naturally with the season's wild flowers", "Colour varies from light to amber by harvest", "No added sugar or syrup"],
    "Take a spoon with warm (not hot) water in the morning, or add to tea, toast and desserts. Do not cook at high heat.",
  ],
  "van-tulsi-raw-honey": [
    ["Raw honey from tulsi-rich forests", "Light herbal notes of tulsi", "Never pasteurised", "Pollen and enzymes left intact"],
    ["Collected from forest bee colonies", "Light, smooth sweetness", "May crystallise in cold weather, which is natural"],
    "Take a spoon with warm (not hot) water in the morning, or add to tea and kadha once it has cooled a little. Do not cook at high heat.",
  ],
  "jaggery-block": [
    ["Traditional solid gud bhheli", "A traditional digestive after meals", "Free from sulphur and chemicals", "Rich, earthy taste of fresh sugarcane"],
    ["Made the old-fashioned way in open pans", "Keeps well for months when stored dry"],
    "Enjoy a small piece after meals, or melt into laddoo, chikki, halwa and kadha.",
  ],
};

const c = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

for (const [handle, [highlights, benefits, howToUse]] of Object.entries(COPY)) {
  const sets = ["benefits = ?", "benefits_text = ?"];
  const params = [JSON.stringify(highlights), benefits.join("\n")];
  if (howToUse) {
    sets.push("how_to_use = ?");
    params.push(howToUse);
  }
  params.push(handle);
  if (dry) {
    console.log("[dry]", handle);
    continue;
  }
  const [r] = await c.execute(`UPDATE products SET ${sets.join(", ")} WHERE handle = ?`, params);
  if (!r.affectedRows) console.warn("no row:", handle);
}

await c.end();
console.log(dry ? "dry run done" : "done");
