// One-off: set product sizes + prices from the client's costing sheet ("Bharat Sir.xlsx", 2026-11).
//   node scripts/import-price-sheet.mjs [--dry]
// Sheet columns used: "Amount" = selling price, "MRP" = strike price. Both are rounded to whole
// rupees (the store keeps money as integers). Sizes not in the sheet are removed, as the admin
// product editor does; stock and availability of existing sizes are kept.
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.local");
} catch {
  // use real env vars
}
const dry = process.argv.includes("--dry");

// [size in ml or g, Amount, MRP], copied from the sheet.
const HONEY = [[150, 247.07, 282.19], [250, 311.96, 366.55], [500, 489.89, 597.86], [1000, 842.8, 1017.64]];
const JAGGERY = [[200, 156.74, 164.76], [500, 212.98, 237.87], [800, 263.81, 303.95], [5000, 1092.45, 1225.18]];
const SHEET = {
  "groundnut-oil": ["ml", [[500, 307.07, 360.19], [1000, 490.93, 599.2], [2000, 930.43, 1157.57], [5000, 2249.91, 2729.89], [15000, 5965.38, 7559.99]]],
  "yellow-mustard-oil": ["ml", [[500, 344.92, 409.4], [1000, 572.04, 704.65], [2000, 1081.85, 1354.4], [5000, 2525.44, 3088.07], [15000, 7133.4, 9078.42]]],
  "black-mustard-oil": ["ml", [[100, 150.51, 156.66], [250, 215.14, 240.69], [500, 317.88, 374.25], [1000, 512.56, 627.32], [2000, 973.7, 1213.8], [5000, 2358.06, 2870.48], [15000, 6160.05, 7813.07]]],
  "sunflower-oil": ["ml", [[500, 377.37, 451.58], [1000, 631.52, 781.98], [2000, 1200.81, 1509.05], [5000, 2822.85, 3474.7]]],
  "brown-sesame-oil": ["ml", [[500, 375.2, 448.77], [1000, 626.11, 774.95], [2000, 1211.62, 1523.11], [5000, 2979.93, 3678.9]]],
  "white-sesame-oil": ["ml", [[500, 402.24, 483.91], [1000, 680.19, 845.24], [2000, 1319.78, 1663.71], [5000, 3147.3, 3896.49]]],
  "black-sesame-oil": ["ml", [[30, 166.47, 177.42], [50, 193.51, 212.57], [100, 231.37, 261.77], [250, 382.77, 458.61], [500, 626.11, 774.95], [1000, 1074.93, 1358.42]]],
  "coconut-oil": ["ml", [[100, 215.4, 241.02], [250, 366.55, 437.52], [500, 609.89, 753.86], [1000, 1085.75, 1372.47]]],
  "castor-oil": ["ml", [[100, 199.18, 219.93], [250, 312.48, 367.22], [500, 480.11, 585.14], [1000, 788.34, 985.84]]],
  "flaxseed-oil": ["ml", [[100, 217.97, 244.37], [250, 355.74, 423.46], [500, 545, 669.5], [1000, 923.52, 1161.58]]],
  "almond-oil": ["ml", [[30, 247.84, 283.2], [50, 318.14, 374.59], [100, 485.77, 592.51], [250, 1031.67, 1302.18], [500, 1896.88, 2426.94], [1000, 3573.2, 4606.16]]],
  "walnut-oil": ["ml", [[30, 250.42, 286.55], [50, 320.72, 377.93], [100, 455.9, 553.68], [250, 950.56, 1196.73], [500, 1734.65, 2216.05]]],
  "jaggery-powder": ["g", JAGGERY],
  "desi-khand": ["g", JAGGERY],
  // The sheet has one "Honey" block; the client sells three honeys at that same rate.
  "jamun-raw-honey": ["g", HONEY],
  "sunderban-raw-honey": ["g", HONEY],
  "van-tulsi-raw-honey": ["g", HONEY],
};

const titleOf = (value, unit) =>
  value >= 1000 ? `${value / 1000} ${unit === "ml" ? "L" : "kg"}` : `${value} ${unit}`;

const db = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

await db.beginTransaction();
try {
  for (const [handle, [unit, rows]] of Object.entries(SHEET)) {
    const [[product]] = await db.query("SELECT id FROM products WHERE handle = ?", [handle]);
    if (!product) throw new Error(`No product with handle ${handle}`);
    const [existing] = await db.query("SELECT variant_key, price, compare_at_price FROM product_variants WHERE product_id = ?", [product.id]);
    const before = new Map(existing.map((r) => [r.variant_key, r]));
    const keep = [];
    for (const [i, [value, amount, mrp]] of rows.entries()) {
      const title = titleOf(value, unit);
      const size = title.replace(/\s+/g, "");
      const key = `${handle}--${size.toLowerCase()}`;
      const price = Math.round(amount);
      const compare = Math.round(mrp);
      keep.push(key);
      const old = before.get(key);
      if (old) {
        await db.query("UPDATE product_variants SET title=?, size_value=?, size_unit=?, price=?, compare_at_price=?, sort_order=? WHERE variant_key=?", [title, value, unit, price, compare, i, key]);
        if (old.price !== price || old.compare_at_price !== compare) console.log(`~ ${key}: ₹${old.price}/${old.compare_at_price} -> ₹${price}/${compare}`);
      } else {
        const sku = `SMP-${handle.toUpperCase().slice(0, 12)}-${size.toUpperCase()}`;
        await db.query(
          "INSERT INTO product_variants (product_id,variant_key,title,size_value,size_unit,sku,price,compare_at_price,stock_qty,available,weight_grams,sort_order) VALUES (?,?,?,?,?,?,?,?,NULL,1,NULL,?)",
          [product.id, key, title, value, unit, sku, price, compare, i],
        );
        console.log(`+ ${key}: ₹${price}/${compare}`);
      }
    }
    for (const key of before.keys()) if (!keep.includes(key)) console.log(`- ${key} (not in sheet)`);
    await db.query("DELETE FROM product_variants WHERE product_id = ? AND variant_key NOT IN (?)", [product.id, keep]);
  }
  if (dry) {
    await db.rollback();
    console.log("dry run: nothing saved");
  } else {
    await db.commit();
    console.log("saved");
  }
} catch (e) {
  await db.rollback();
  throw e;
}
await db.end();
