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

const ALLOWED_FORMATS = "jpg,jpeg,png,webp,avif,heic";
export type UploadFolder = "products" | "banners";

/**
 * Signature for a direct browser → Cloudinary upload (files never pass through our server,
 * so there is no request-size limit and no server CPU spent). Originals are stored untouched.
 */
export function signUpload(folder: UploadFolder) {
  const params = {
    folder: `swadeshi-mahadev/${folder}`,
    timestamp: Math.round(Date.now() / 1000),
    allowed_formats: ALLOWED_FORMATS,
  };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
  return {
    ...params,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  };
}

export async function destroyImage(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (e) {
    console.error("Cloudinary destroy failed", publicId, e);
  }
}

/** Only accept URLs that point at our own Cloudinary account and folder. */
export function isOwnCloudinaryUrl(url: string, publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return (
    url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) &&
    publicId.startsWith("swadeshi-mahadev/") &&
    url.includes(publicId)
  );
}
