/**
 * next/image loader. Cloudinary images get resized + re-encoded on Cloudinary's CDN:
 *  - f_auto: AVIF/WebP for browsers that support it
 *  - q_auto:good: perceptual quality (no visible loss, much smaller files)
 *  - c_limit,w_N: never upscale, only shrink to the size actually shown
 * Originals stay untouched on Cloudinary. Local files (SVG placeholders) pass through.
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
  return src;
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
