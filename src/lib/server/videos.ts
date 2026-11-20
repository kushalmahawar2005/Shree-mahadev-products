import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";

/**
 * Where a reel shows: homepage reels, the product pages of one category, or "product":
 * only on its tagged product's page, in the video row next to the buy box.
 */
export const REEL_PLACEMENTS = ["home", "oil", "honey", "sweetener", "product"] as const;
export type ReelPlacement = (typeof REEL_PLACEMENTS)[number];

export type Reel = {
  id: number;
  publicId: string;
  videoUrl: string;
  width: number;
  height: number;
  duration: number | null;
  caption: string;
  productHandle: string | null;
  /** Uploaded reels: optional "Watch on Instagram" link. Link-only reels (videoUrl ""): the YouTube link. */
  instagramUrl: string | null;
  active: boolean;
  placements: ReelPlacement[];
};

function parsePlacements(v: unknown): ReelPlacement[] {
  const arr = typeof v === "string" ? (JSON.parse(v) as unknown) : v;
  if (!Array.isArray(arr)) return ["home"];
  return arr.filter((x): x is ReelPlacement => (REEL_PLACEMENTS as readonly string[]).includes(x as string));
}

const toReel = (r: RowDataPacket): Reel => ({
  id: r.id,
  publicId: r.public_id,
  videoUrl: r.video_url,
  width: r.width,
  height: r.height,
  duration: r.duration === null ? null : Number(r.duration),
  caption: r.caption,
  productHandle: r.product_handle,
  instagramUrl: r.instagram_url,
  active: !!r.active,
  placements: parsePlacements(r.placements),
});

export async function listReels(onlyActive = false): Promise<Reel[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT * FROM reels ${onlyActive ? "WHERE active = 1" : ""} ORDER BY sort_order, id LIMIT 30`,
  );
  return rows.map(toReel);
}

export async function addReels(
  items: { publicId: string; url: string; width: number; height: number; duration?: number }[],
  placements: ReelPlacement[] = ["home"],
  productHandle: string | null = null,
) {
  if (!items.length) return;
  const [[{ next }]] = await db().query<RowDataPacket[]>("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM reels");
  await db().query("INSERT INTO reels (public_id, video_url, width, height, duration, sort_order, placements, product_handle) VALUES ?", [
    items.map((v, i) => [v.publicId, v.url, v.width, v.height, v.duration ?? null, Number(next) + i, JSON.stringify(placements), productHandle]),
  ]);
}

/** A reel that is only a YouTube link (no uploaded file): video_url is empty, instagram_url holds the link. */
export async function addReelLink(link: string, placements: ReelPlacement[] = ["home"]) {
  const [[{ next }]] = await db().query<RowDataPacket[]>("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM reels");
  await db().execute("INSERT INTO reels (public_id, video_url, width, height, instagram_url, sort_order, placements) VALUES ('', '', 0, 0, ?, ?, ?)", [
    link,
    Number(next),
    JSON.stringify(placements),
  ]);
}

export async function updateReel(id: number, p: { caption?: string; productHandle?: string | null; instagramUrl?: string | null; active?: boolean; placements?: ReelPlacement[] }) {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (p.caption !== undefined) {
    sets.push("caption = ?");
    vals.push(p.caption.slice(0, 160));
  }
  if (p.productHandle !== undefined) {
    sets.push("product_handle = ?");
    vals.push(p.productHandle);
  }
  if (p.instagramUrl !== undefined) {
    sets.push("instagram_url = ?");
    vals.push(p.instagramUrl);
  }
  if (p.placements !== undefined) {
    sets.push("placements = ?");
    vals.push(JSON.stringify(p.placements));
  }
  if (p.active !== undefined) {
    sets.push("active = ?");
    vals.push(p.active ? 1 : 0);
  }
  if (sets.length) await db().execute(`UPDATE reels SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
}

export async function reorderReels(ids: number[]) {
  if (!ids.length) return;
  await db().query(`UPDATE reels SET sort_order = CASE id ${ids.map(() => "WHEN ? THEN ?").join(" ")} END WHERE id IN (?)`, [
    ...ids.flatMap((id, i) => [id, i]),
    ids,
  ]);
}

/**
 * Swap a reel's video file, keeping its places, caption, product and position. Returns the old
 * file's public id (empty for our built-in clips and YouTube-only reels, which have no file to delete).
 */
export async function replaceReelVideo(id: number, v: { publicId: string; url: string; width: number; height: number; duration?: number }): Promise<string | null> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT public_id, video_url FROM reels WHERE id = ?", [id]);
  if (!rows[0]) throw new Error("Reel not found");
  await db().execute(
    // A YouTube-only reel keeps its link in instagram_url: drop it, the uploaded file now plays.
    "UPDATE reels SET public_id = ?, video_url = ?, width = ?, height = ?, duration = ?, instagram_url = IF(?, NULL, instagram_url) WHERE id = ?",
    [v.publicId, v.url, v.width, v.height, v.duration ?? null, rows[0].video_url ? 0 : 1, id],
  );
  return rows[0].public_id || null;
}

export async function deleteReel(id: number): Promise<string | null> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT public_id FROM reels WHERE id = ?", [id]);
  if (!rows[0]) return null;
  await db().execute<ResultSetHeader>("DELETE FROM reels WHERE id = ?", [id]);
  return rows[0].public_id;
}

// ───────────── Store settings (key → JSON) ─────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = ?", [key]);
  if (!rows[0]) return fallback;
  const v = rows[0].value;
  // mysql2 already parses JSON columns on MySQL; MariaDB returns the raw JSON text.
  if (typeof v !== "string") return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return v as T;
  }
}

export async function setSetting(key: string, value: unknown) {
  await db().execute(
    "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [key, JSON.stringify(value)],
  );
}
