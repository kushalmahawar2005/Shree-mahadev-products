import { cldVideo, cldVideoPoster } from "@/lib/image-loader";

/** Our own ghani footage, hosted on Cloudinary (swadeshi-mahadev/videos/…), not in /public. */
const BASE = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload/swadeshi-mahadev/videos/`;

export type SiteVideoName =
  | "ghani-film"
  | "ghani-pour-desktop"
  | "reels/bottling"
  | "reels/coconut-in"
  | "reels/ghani-1"
  | "reels/ghani-2"
  | "reels/ghani-3"
  | "reels/ghani-pour"
  | "reels/oil-pour";

/** Original upload URL (pass it through cldVideo / cldVideoPoster, like admin-uploaded reels). */
export const siteVideoUrl = (name: SiteVideoName) => `${BASE}${name}.mp4`;

/** Ready-to-use src + poster at a display width. */
export const siteVideo = (name: SiteVideoName, width = 640) => ({
  src: cldVideo(siteVideoUrl(name), width),
  poster: cldVideoPoster(siteVideoUrl(name), width),
});
