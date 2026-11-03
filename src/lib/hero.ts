import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { heroSlides, type HeroSlide } from "@/data/hero";
import { listBanners } from "@/lib/server/media";

/** Hero slides from the admin (Cloudinary). Falls back to the bundled placeholders. */
export async function getHeroSlides(): Promise<HeroSlide[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("banners");
  if (!process.env.DATABASE_NAME) return heroSlides;
  try {
    const rows = await listBanners(true);
    if (!rows.length) return heroSlides;
    return rows.map((b) => ({ src: b.desktop!.url, mobileSrc: b.mobile?.url, alt: b.alt || "Swadeshi Mahadev Products", href: b.href }));
  } catch (e) {
    console.error("getHeroSlides failed", e);
    return heroSlides;
  }
}
