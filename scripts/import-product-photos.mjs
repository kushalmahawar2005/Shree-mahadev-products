// One-off: upload the client's product photos to Cloudinary and link them in `product_images`.
//   node scripts/import-product-photos.mjs <dir-with-unzipped-folders> [--dry | --list | --cutouts]
//     --list     print "<source path>\t<public id>" for every front shot (input for the cut-out tool)
//     --cutouts  upload <dir>/_cutouts/<handle>/<size>-cutout.png (transparent product, no backdrop).
//                Cut-outs are not gallery rows: the site derives their URL from the front shot's URL
//                (see cutoutUrl in src/lib/image-loader.ts).
// <dir> holds one folder per client zip (folder name = zip name, trailing spaces trimmed).
// Re-runnable: public ids are fixed (overwrite) and each product's rows are replaced.
// Gallery order per product: main front, main back, other sizes (front), nutrition card.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { v2 as cloudinary } from "cloudinary";

try {
  process.loadEnvFile(".env.local");
} catch {
  // use real env vars
}

const [dir, flag] = process.argv.slice(2);
const dry = flag === "--dry";
// Stored small enough to stay fast: packshots as 1600 px JPEG (they have their own backdrop), cut-outs as
// 900 px-tall PNG (they need transparency). Full-size originals stay in the client's zips.
const upload = (path, publicId) =>
  cloudinary.uploader.upload(path, {
    folder: "swadeshi-mahadev/products",
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    ...(publicId.endsWith("-cutout")
      ? { format: "png", transformation: [{ height: 900, crop: "limit" }] }
      : { format: "jpg", transformation: [{ width: 1600, crop: "limit", quality: 90 }] }),
  });
if (!dir) {
  console.error("Usage: node scripts/import-product-photos.mjs <dir> [--dry]");
  process.exit(1);
}

const NUT = "black mustard Nutrition";
const NUT_HONEY = "black mustard Nutrition (1)"; // newer honey cards

/** [file, size label, view] — first entry is the card image, second the hover image. */
const PRODUCTS = {
  "almond-oil": { dir: "Almond", pack: "bottle", nutrition: [NUT, "2.png"], shots: [
    ["Almond 1L.png", "1 L", "front"], ["1L Back.png", "1 L", "back"],
    ["500ml.png", "500 ml", "front"], ["250ml.png", "250 ml", "front"], ["100ml.png", "100 ml", "front"],
    ["50ml.png", "50 ml", "front"], ["30ml.png", "30 ml", "front"],
  ] },
  "black-mustard-oil": { dir: "Black MUSTARD OIL", pack: "bottle", nutrition: [NUT, "12.png"], shots: [
    ["1L.png", "1 L", "front"], ["1L BACK.png", "1 L", "back"],
    ["5L.png", "5 L", "front"], ["3.png", "2 L", "front"], ["250ml.png", "250 ml", "front"], ["100ml.png", "100 ml", "front"],
    // "500ml.png" in the zip is a turned (side/back) view, not a front shot: left out.
  ] },
  "brown-sesame-oil": { dir: "Brown Sesame", pack: "bottle", nutrition: [NUT, "10.png"], shots: [
    ["1L.png", "1 L", "front"], ["1L Back.png", "1 L", "back"],
    ["brown sesame5L front.png", "5 L", "front"], ["2L.png", "2 L", "front"], ["500ml.png", "500 ml", "front"],
  ] },
  "castor-oil": { dir: "Castrol Oil", pack: "bottle", nutrition: [NUT, "8.png"], shots: [
    ["Castor 1L.png", "1 L", "front"], ["2.png", "1 L", "back"],
    ["500ml.png", "500 ml", "front"], ["250ml.png", "250 ml", "front"], ["100ml.png", "100 ml", "front"],
  ] },
  "coconut-oil": { dir: "COCONUT OIL", pack: "bottle", nutrition: [NUT, "7.png"], shots: [
    ["coconut 1L.png", "1 L", "front"], ["1L Back.png", "1 L", "back"],
    ["coconut 500ml.png", "500 ml", "front"], ["250ml Front.png", "250 ml", "front"], ["100ml.png", "100 ml", "front"],
  ] },
  "desi-khand": { dir: "Desi Khand", pack: "jar", shots: [
    ["3.png", "500 g", "front"], ["4.png", "500 g", "back"],
    ["desi khand 800 front.png", "800 g", "front"], ["5.png", "200 g", "front"],
  ] },
  "flaxseed-oil": { dir: "Flexseed", pack: "bottle", nutrition: [NUT, "9.png"], shots: [
    ["Flaxseed 1L.png", "1 L", "front"], ["1L Back.png", "1 L", "back"],
    ["500ml.png", "500 ml", "front"], ["250ml front.png", "250 ml", "front"], ["100ml flaxseed.png", "100 ml", "front"],
  ] },
  "groundnut-oil": { dir: "groundnut", pack: "bottle", nutrition: [NUT, "6.png"], shots: [
    ["Groundnut 1L.png", "1 L", "front"], ["1L back.png", "1 L", "back"],
    ["Groundnut 15L.png", "15 L", "front"], ["Groundnut  5L.png", "5 L", "front"], ["Groundnut  2L.png", "2 L", "front"],
    ["500ml.png", "500 ml", "front"],
  ] },
  "jaggery-powder": { dir: "Jaggery", pack: "jar", shots: [
    ["3.png", "500 g", "front"], ["5.png", "500 g", "back"],
    ["1.png", "800 g", "front"], ["200ml.png", "200 g", "front"],
  ] },
  "jamun-raw-honey": { dir: "jamun", pack: "jar", nutrition: [NUT_HONEY, "15.png"], shots: [
    ["500 gm Front.png", "500 g", "front"], ["500 gm back.png", "500 g", "back"],
    ["1kg Front.png", "1 kg", "front"], ["250 front.png", "250 g", "front"], ["150 front.png", "150 g", "front"],
  ] },
  "sunderban-raw-honey": { dir: "Sundarban", pack: "jar", nutrition: [NUT_HONEY, "14.png"], shots: [
    ["5.png", "500 g", "front"], ["6.png", "500 g", "back"],
    ["Sundarban 1kg front.png", "1 kg", "front"], ["7.png", "250 g", "front"], ["150 gm front.png", "150 g", "front"],
  ] },
  "sunflower-oil": { dir: "Sunflower", pack: "bottle", nutrition: [NUT, "5.png"], shots: [
    ["Sun FLower 1L.png", "1 L", "front"], ["1L back.png", "1 L", "back"],
    ["sunflower 5L.png", "5 L", "front"], ["3.png", "2 L", "front"], ["Sunflower 500ml.png", "500 ml", "front"],
  ] },
  "van-tulsi-raw-honey": { dir: "van tulsi", pack: "jar", nutrition: [NUT_HONEY, "16.png"], shots: [
    ["500gm Front.png", "500 g", "front"], ["500gm Back.png", "500 g", "back"],
    ["1kg Front.png", "1 kg", "front"], ["250gm Front.png", "250 g", "front"], ["7.png", "150 g", "front"],
  ] },
  "walnut-oil": { dir: "walnut 30ML", pack: "bottle", nutrition: [NUT, "4.png"], shots: [
    ["500ml front.png", "500 ml", "front"], ["500 back.png", "500 ml", "back"],
    ["walnut 250ml.png", "250 ml", "front"], ["walnut 100ml.png", "100 ml", "front"],
    ["50ml neww.png", "50 ml", "front"], ["30ml front.png", "30 ml", "front"],
  ] },
  "white-sesame-oil": { dir: "White seasame", pack: "bottle", nutrition: [NUT, "3.png"], shots: [
    ["yellow sesame 1l.png", "1 L", "front"], ["1L back.png", "1 L", "back"],
    ["white sesame 5L.png", "5 L", "front"], ["white sesame 2L.png", "2 L", "front"], ["white seasme 500ml.png", "500 ml", "front"],
  ] },
  "yellow-mustard-oil": { dir: "Yellow Mustard Oil  (1)", pack: "bottle", nutrition: [NUT, "Yellow Mutard Oil.png"], shots: [
    ["mustard yellow 1L.png", "1 L", "front"], ["1L back.png", "1 L", "back"],
    ["15 L Front.png", "15 L", "front"], ["mustar yellow 5L.png", "5 L", "front"], ["yellow mustar 2L.png", "2 L", "front"],
    ["500ml back.png", "500 ml", "front"], // misnamed in the zip: this is the 500 ml front
  ] },
};

const packWord = (pack, size) => (pack === "bottle" && /^(5|15) L$/.test(size) ? (size === "15 L" ? "tin" : "can") : pack);

const db = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Build the job list and fail early on anything missing.
const [titles] = await db.query("SELECT handle, title FROM products");
const titleOf = new Map(titles.map((r) => [r.handle, r.title]));
const jobs = [];
for (const [handle, p] of Object.entries(PRODUCTS)) {
  const title = titleOf.get(handle);
  if (!title) throw new Error(`No product with handle ${handle}`);
  p.shots.forEach(([file, size, view], n) => {
    jobs.push({
      handle, n, path: join(dir, p.dir, file),
      publicId: `${handle}/${size.replace(/\s+/g, "").toLowerCase()}-${view}`,
      alt: `${title} ${size} ${packWord(p.pack, size)}, ${view === "front" ? "front label" : "back label"}`,
    });
  });
  if (p.nutrition) {
    jobs.push({
      handle, n: p.shots.length, path: join(dir, ...p.nutrition),
      publicId: `${handle}/nutrition`, alt: `${title} ingredients and nutritional facts`,
    });
  }
}
const missing = jobs.filter((j) => !existsSync(j.path));
if (missing.length) {
  console.error("Missing files:\n" + missing.map((j) => "  " + j.path).join("\n"));
  process.exit(1);
}
if (flag === "--list") {
  for (const j of jobs) if (j.publicId.endsWith("-front")) console.log(`${j.path}\t${j.publicId.replace(/-front$/, "-cutout")}`);
  await db.end();
  process.exit(0);
}
if (flag === "--cutouts") {
  const root = join(dir, "_cutouts");
  const files = readdirSync(root).flatMap((h) => readdirSync(join(root, h)).filter((f) => f.endsWith(".png")).map((f) => [join(root, h, f), `${h}/${f.slice(0, -4)}`]));
  let n = 0;
  const q = [...files];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let f = q.shift(); f; f = q.shift()) {
      await upload(f[0], f[1]);
      if (++n % 20 === 0 || n === files.length) console.log(`uploaded ${n}/${files.length} cut-outs`);
    }
  }));
  await db.end();
  process.exit(0);
}
console.log(`${jobs.length} images for ${Object.keys(PRODUCTS).length} products`);
if (dry) {
  for (const j of jobs) console.log(`${j.handle} #${j.n}  ${j.publicId}  |  ${j.alt}`);
  await db.end();
  process.exit(0);
}

// Upload, 4 at a time.
let done = 0;
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const r = await upload(j.path, j.publicId);
      Object.assign(j, { url: r.secure_url, cid: r.public_id, width: r.width, height: r.height });
      if (++done % 10 === 0 || done === jobs.length) console.log(`uploaded ${done}/${jobs.length}`);
    }
  }),
);

// Replace each product's rows in one transaction.
await db.beginTransaction();
try {
  await db.query("DELETE FROM product_images WHERE product_handle IN (?)", [Object.keys(PRODUCTS)]);
  await db.query(
    "INSERT INTO product_images (product_handle, public_id, url, alt, width, height, sort_order) VALUES ?",
    [jobs.map((j) => [j.handle, j.cid, j.url, j.alt.slice(0, 255), j.width, j.height, j.n])],
  );
  await db.commit();
} catch (e) {
  await db.rollback();
  throw e;
}
console.log(`linked ${jobs.length} images in product_images`);
await db.end();
