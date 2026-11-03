import "server-only";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function cloudinaryConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  );
}

/** Upload a local file or remote URL into the store's folder. Returns the delivery URL + size. */
export async function uploadImage(source: string, opts: { folder: string; publicId?: string }) {
  const r = await cloudinary.uploader.upload(source, {
    folder: `swadeshi-mahadev/${opts.folder}`,
    public_id: opts.publicId,
    overwrite: true,
    resource_type: "image",
  });
  return { url: r.secure_url, width: r.width, height: r.height, publicId: r.public_id };
}

export { cloudinary };
