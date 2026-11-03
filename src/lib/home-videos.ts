import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { brandFilm } from "@/data/home";
import { getSetting, listReels, type Reel } from "@/lib/server/videos";

/** Homepage reels + brand-film link, managed in /admin/videos. Cached; admin saves bust the tag. */
export async function getHomeVideos(): Promise<{ reels: Reel[]; youtube: string }> {
  "use cache";
  cacheLife("hours");
  cacheTag("videos");
  if (!process.env.DATABASE_NAME) return { reels: [], youtube: brandFilm.youtube };
  try {
    const [reels, youtube] = await Promise.all([listReels(true), getSetting<string>("brand_film_youtube", brandFilm.youtube)]);
    return { reels, youtube };
  } catch (e) {
    console.error("getHomeVideos failed", e);
    return { reels: [], youtube: brandFilm.youtube };
  }
}
