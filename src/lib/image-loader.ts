/**
 * next/image loader. Cloudinary images get resized + re-encoded on Cloudinary's CDN:
 *  - f_auto: AVIF/WebP for browsers that support it
 *  - q_auto:good: perceptual quality (no visible loss, much smaller files)
 *  - c_limit,w_N: never upscale, only shrink to the size actually shown
 * Originals stay untouched on Cloudinary. Local files pass through (with a `w` query, see below).
 */
const MARK = "/image/upload/";

export function cldUrl(src: string, width?: number, quality?: number) {
  if (!src.startsWith("https://res.cloudinary.com/") || !src.includes(MARK)) return src;
  const q = quality && quality >= 90 ? "q_auto:best" : "q_auto:good";
  const t = ["f_auto", q, "dpr_1", ...(width ? ["c_limit", `w_${width}`] : [])].join(",");
  return src.replace(MARK, `${MARK}${t}/`);
}

export default function cloudinaryLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("https://res.cloudinary.com/")) return cldUrl(src, width, quality);
  // Local/other files are served as-is. Still encode the width (static files ignore the query) so
  // each srcset entry is distinct and next/image doesn't warn that the loader ignores `width`.
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}

/** Cloudinary video: auto codec/quality, capped width (shrinks big phone recordings a lot). */
export function cldVideo(url: string, width = 720) {
  return url.replace("/video/upload/", `/video/upload/f_auto:video,q_auto,c_limit,w_${width}/`);
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
