// One-off: push public/ raster images to Cloudinary and print a path → URL map (JSON).
import { readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { v2 as cloudinary } from "cloudinary";

process.loadEnvFile(".env.local");
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk("public").filter((f) => [".png", ".jpg", ".jpeg", ".webp"].includes(extname(f).toLowerCase()));
const map = {};
for (const f of files) {
  const rel = "/" + relative("public", f);
  const publicId = rel.slice(1).replace(extname(rel), "").replace(/[^a-zA-Z0-9/_-]/g, "-");
  const r = await cloudinary.uploader.upload(f, { folder: "swadeshi-mahadev/static", public_id: publicId, overwrite: true });
  map[rel] = r.secure_url;
}
console.log(JSON.stringify(map, null, 2));
