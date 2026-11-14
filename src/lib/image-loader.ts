/**
 * next/image loader. Cloudinary images get resized + re-encoded on Cloudinary's CDN:
 *  - f_auto: AVIF/WebP for browsers that support it
 *  - q_auto:good: perceptual quality (no visible loss, much smaller files)
 *  - c_limit,w_N: never upscale, only shrink to the size actually shown
 * Originals stay untouched on Cloudinary. Local public/ images go through their Cloudinary mirror.
 */
const MARK = "/image/upload/";

export function cldUrl(src: string, width?: number, quality?: number) {
  if (!src.startsWith("https://res.cloudinary.com/") || !src.includes(MARK)) return src;
  const q = quality && quality >= 90 ? "q_auto:best" : "q_auto:good";
  const t = ["f_auto", q, "dpr_1", ...(width ? ["c_limit", `w_${width}`] : [])].join(",");
  return src.replace(MARK, `${MARK}${t}/`);
}

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/**
 * public/ raster images are mirrored on Cloudinary by scripts/upload-static.mjs (run before deploy)
 * at swadeshi-mahadev/static/<path without extension>. Must match publicIdOf() in that script.
 */
export function staticCldPath(src: string) {
  if (!CLOUD || !/^\/[^?#]+\.(png|jpe?g|webp)$/i.test(src)) return null;
  const id = "swadeshi-mahadev/static/" + src.slice(1).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9/_-]/g, "-");
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${id}`;
}

export default function cloudinaryLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("https://res.cloudinary.com/")) return cldUrl(src, width, quality);
  // Local public/ images: resized + AVIF/WebP from Cloudinary's CDN instead of full-size from our server.
  const mirrored = staticCldPath(src);
  if (mirrored) return cldUrl(mirrored, width, quality);
  // Local/other files are served as-is. Still encode the width (static files ignore the query) so
  // each srcset entry is distinct and next/image doesn't warn that the loader ignores `width`.
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}

/**
 * Video renditions are generated once at upload (eager), because Cloudinary answers 423 "still processing"
 * to the first request of a new on-the-fly video transform. So every <video> uses one of these fixed sizes.
 */
export const VIDEO_WIDTHS = [480, 640, 960] as const;
export const videoTransform = (w: number) => `q_auto,vc_h264,c_limit,w_${w}`;
/** Value for Cloudinary's `eager` upload parameter: all renditions cldVideo() can ask for. */
export const VIDEO_EAGER = VIDEO_WIDTHS.map((w) => `${videoTransform(w)}/mp4`).join("|");

/** Cloudinary video: H.264 MP4 at the nearest pre-generated width (480 / 640 / 960). */
export function cldVideo(url: string, width = 640) {
  const w = width <= 560 ? 480 : width <= 800 ? 640 : 960;
  return url
    .replace("/video/upload/", `/video/upload/${videoTransform(w)}/`)
    .replace(/\.(mov|webm|m4v)$/i, ".mp4");
}

/** Still frame from a Cloudinary video, for the poster. */
export function cldVideoPoster(url: string, width = 480) {
  return url
    .replace("/video/upload/", `/video/upload/so_1,f_auto,q_auto,c_limit,w_${width}/`)
    .replace(/\.(mp4|mov|webm|m4v)$/i, ".jpg");
}

// Product photos imported by scripts/import-product-photos.mjs are named <handle>/<size>-front|back, with a
// transparent <size>-cutout next to each front shot. Admin uploads have random names and pass through unchanged.
const PACKSHOT = /(\/swadeshi-mahadev\/products\/[a-z0-9-]+\/[a-z0-9.]+)-(?:front|back)\.\w+$/;

/** Transparent cut-out of a packshot (for small thumbnails on coloured tiles). Other URLs are returned as is. */
export function cutoutUrl(url: string) {
  return url.replace(PACKSHOT, "$1-cutout.png");
}

/** Cut-out sized for a thumbnail shown at `size` CSS px; for <Image unoptimized> and plain <img>. */
export function thumbUrl(url: string, size = 80) {
  return cldUrl(cutoutUrl(url), size * 2);
}

/** The front photo of one size ("2 L" -> .../2l-front), if the product has one. */
export function variantImage<T extends { url: string }>(images: T[], variantTitle?: string): T | undefined {
  if (!variantTitle) return undefined;
  const slug = variantTitle.toLowerCase().replace(/\s+/g, "");
  return images.find((i) => i.url.includes(`/${slug}-front.`));
}
