import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { VIDEO_EAGER } from "@/lib/image-loader";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function cloudinaryConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

/** Upload a local file or remote URL into the store's folder. Returns the delivery URL + size. */
export async function uploadImage(
  source: string,
  opts: { folder: string; publicId?: string },
) {
  const r = await cloudinary.uploader.upload(source, {
    folder: `swadeshi-mahadev/${opts.folder}`,
    public_id: opts.publicId,
    overwrite: true,
    resource_type: "image",
  });
  return {
    url: r.secure_url,
    width: r.width,
    height: r.height,
    publicId: r.public_id,
  };
}

export { cloudinary };

const IMAGE_FORMATS = "jpg,jpeg,png,webp,avif,heic";
const VIDEO_FORMATS = "mp4,mov,webm,m4v";
/**
 * Incoming transformation for videos: Cloudinary re-encodes before storing, so the saved file is
 * small (max 960px wide / 1706px tall, H.264 + AAC, auto quality) instead of a 1080p+ phone original.
 * The site never plays above 960px (see cldVideo), so nothing visible is lost.
 */
const VIDEO_INCOMING = "c_limit,w_960,h_1706,q_auto:good,vc_h264,ac_aac";
export type UploadFolder = "products" | "banners" | "reels" | "reviews" | "collections";

/**
 * Signature for a direct browser → Cloudinary upload (files never pass through our server,
 * so there is no request-size limit and no server CPU spent). Images are stored untouched;
 * videos are compressed on arrival (VIDEO_INCOMING).
 */
export function signUpload(folder: UploadFolder) {
  const params = {
    folder: `swadeshi-mahadev/${folder}`,
    timestamp: Math.round(Date.now() / 1000),
    allowed_formats: folder === "reels" ? VIDEO_FORMATS : IMAGE_FORMATS,
    // Videos: build every rendition the site plays right away, in the background (see cldVideo).
    ...(folder === "reels" ? { eager: VIDEO_EAGER, eager_async: "true", transformation: VIDEO_INCOMING } : {}),
  };
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!,
  );
  return {
    ...params,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
    resourceType: folder === "reels" ? ("video" as const) : ("image" as const),
  };
}

/** public_id from one of our delivery URLs (".../upload/v123/swadeshi-mahadev/reels/abc.mp4"). */
export function publicIdFromUrl(url: string): { publicId: string; resourceType: "image" | "video" } | null {
  const m = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:[^/]*,[^/]*\/)*(?:v\d+\/)?(swadeshi-mahadev\/.+?)(?:\.[a-z0-9]{2,5})?$/i);
  return m ? { publicId: m[2], resourceType: m[1] as "image" | "video" } : null;
}

export async function destroyImage(
  publicId: string,
  resourceType: "image" | "video" = "image",
) {
  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: resourceType,
    });
  } catch (e) {
    console.error("Cloudinary destroy failed", publicId, e);
  }
}

/** Only accept URLs that point at our own Cloudinary account and folder. */
export function isOwnCloudinaryUrl(url: string, publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return (
    (url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) ||
      url.startsWith(`https://res.cloudinary.com/${cloud}/video/upload/`)) &&
    publicId.startsWith("swadeshi-mahadev/") &&
    url.includes(publicId)
  );
}
