import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { DEFAULT_STORIES, type Story } from "@/data/pdp-story";
import type { ProductCategory } from "@/lib/commerce/types";
import { db } from "./db";
import { destroyImage, publicIdFromUrl } from "./cloudinary";

export const PDP_STORY_TAG = "pdp-story";
const KEY = "pdp_story";
export type StoryMap = Partial<Record<ProductCategory, Story>>;

/** Saved overrides only (no defaults). Admin editor reads this to know what is customised. */
export async function readStoryOverrides(): Promise<StoryMap> {
  const [[row]] = await db().query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = ?", [KEY]);
  if (!row) return {};
  return (typeof row.value === "string" ? JSON.parse(row.value) : row.value) as StoryMap;
}

/** Product page story per category: saved version if any, otherwise the built-in copy. Cached, busted by updateTag. */
export async function getPdpStories(): Promise<StoryMap> {
  "use cache";
  cacheLife("hours");
  cacheTag(PDP_STORY_TAG);
  if (!process.env.DATABASE_NAME) return DEFAULT_STORIES;
  try {
    return { ...DEFAULT_STORIES, ...(await readStoryOverrides()) };
  } catch (e) {
    console.error("getPdpStories", e);
    return DEFAULT_STORIES;
  }
}

export async function saveStoryOverrides(map: StoryMap) {
  await db().query("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [KEY, JSON.stringify(map)]);
}

/** Every media URL a story map points at (reel videos, Instagram covers, step / check photos). */
function mediaUrls(map: StoryMap): Set<string> {
  const out = new Set<string>();
  for (const s of Object.values(map)) {
    if (!s) continue;
    s.method?.steps.forEach((x) => x.image && out.add(x.image));
    s.checks?.items.forEach((x) => x.image && out.add(x.image));
    s.reels?.forEach((r) => (r.video && out.add(r.video), r.cover && out.add(r.cover)));
  }
  return out;
}

/** Only files the admin uploaded from this editor; never the site's built-in clips (swadeshi-mahadev/videos/...). */
const DELETABLE = /^swadeshi-mahadev\/(reels|products)\//;

/**
 * After a save: delete from Cloudinary the uploads that were in the old story but not the new one,
 * as long as nothing else still uses them (another category, the homepage reels, a product photo).
 */
export async function removeUnusedStoryMedia(before: StoryMap, after: StoryMap) {
  const keep = mediaUrls(after);
  const gone = [...mediaUrls(before)].filter((u) => !keep.has(u));
  for (const url of gone) {
    const id = publicIdFromUrl(url);
    if (!id || !DELETABLE.test(id.publicId)) continue;
    const [[used]] = await db().query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM reels WHERE public_id = ? OR video_url = ?)
            + (SELECT COUNT(*) FROM product_images WHERE url = ?) AS n`,
      [id.publicId, url, url],
    );
    if (Number(used?.n ?? 0) > 0) continue;
    await destroyImage(id.publicId, id.resourceType);
  }
}
