// Sync public/ raster images to Cloudinary (folder swadeshi-mahadev/static, same path, no extension),
// so next/image can serve them resized + AVIF/WebP from Cloudinary's CDN (see staticCldPath in
// src/lib/image-loader.ts). Only new or changed files are uploaded (local md5 vs the md5 saved in
// the asset's context metadata on the last upload).
// Run before every deploy: node scripts/upload-static.mjs
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { v2 as cloudinary } from "cloudinary";

try { process.loadEnvFile(".env.local"); } catch {}
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const all = walk("public").filter((f) => [".png", ".jpg", ".jpeg", ".webp"].includes(extname(f).toLowerCase()));
// Same name in two formats (e.g. a .png source next to the .webp the site uses) share one Cloudinary id:
// keep only the .webp so they don't overwrite each other.
const files = all.filter((f) => extname(f).toLowerCase() === ".webp" || !all.includes(f.replace(/\.[^.]+$/, ".webp")));
/** Must match staticCldPath() in src/lib/image-loader.ts. */
const publicIdOf = (rel) => "swadeshi-mahadev/static/" + rel.slice(1).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9/_-]/g, "-");

// One listing call (paginated) instead of one Admin API call per file: the Admin API is rate-limited.
const known = new Map();
try {
  let cursor;
  do {
    const page = await cloudinary.api.resources({ type: "upload", prefix: "swadeshi-mahadev/static/", context: true, max_results: 500, next_cursor: cursor });
    for (const r of page.resources) known.set(r.public_id, r.context?.custom?.md5);
    cursor = page.next_cursor;
  } while (cursor);
} catch (e) {
  console.warn("Could not list Cloudinary assets (rate limit?), uploading everything:", e.error?.message ?? e.message ?? e);
}

let uploaded = 0, skipped = 0, failed = 0;
async function sync(f) {
  const rel = "/" + relative("public", f).split("\\").join("/");
  const id = publicIdOf(rel);
  const md5 = createHash("md5").update(readFileSync(f)).digest("hex");
  try {
    if (known.get(id) === md5) return void skipped++;
    await cloudinary.uploader.upload(f, { public_id: id, overwrite: true, invalidate: true, unique_filename: false, context: { md5 } });
    uploaded++;
    console.log("↑", rel);
  } catch (e) {
    failed++;
    console.error("✗", rel, e.message ?? e);
  }
}
for (let i = 0; i < files.length; i += 6) await Promise.all(files.slice(i, i + 6).map(sync));
console.log(`static images: ${uploaded} uploaded, ${skipped} unchanged, ${failed} failed (of ${files.length})`);
if (failed) process.exit(1);
