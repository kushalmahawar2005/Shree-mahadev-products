import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { DEFAULT_SETTINGS, liveAnnouncements, StoreSettingsSchema, type StoreSettings } from "@/lib/store-settings";
import { db } from "./db";

export const SETTINGS_TAG = "settings";
const KEYS = { business: "business", shipping: "shipping", announcement: "announcement", socials: "socials", lowStockThreshold: "low_stock_threshold" } as const;

async function readRaw(): Promise<Partial<Record<keyof typeof KEYS, unknown>>> {
  const [rows] = await db().query<RowDataPacket[]>("SELECT `key`, value FROM settings WHERE `key` IN (?)", [Object.values(KEYS)]);
  const byKey = new Map(rows.map((r) => [r.key as string, typeof r.value === "string" ? JSON.parse(r.value) : r.value]));
  return Object.fromEntries(Object.entries(KEYS).map(([k, dbKey]) => [k, byKey.get(dbKey)]));
}

/** Store settings for the whole site (cached; admin save calls updateTag("settings")). Falls back to defaults. */
export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);
  if (!process.env.DATABASE_NAME) return DEFAULT_SETTINGS;
  try {
    const raw = await readRaw();
    const merged = {
      business: { ...DEFAULT_SETTINGS.business, ...(raw.business as object) },
      shipping: { ...DEFAULT_SETTINGS.shipping, ...(raw.shipping as object) },
      announcement: (raw.announcement as StoreSettings["announcement"]) ?? DEFAULT_SETTINGS.announcement,
      socials: (raw.socials as StoreSettings["socials"]) ?? DEFAULT_SETTINGS.socials,
      lowStockThreshold: (raw.lowStockThreshold as number) ?? DEFAULT_SETTINGS.lowStockThreshold,
    };
    const ok = StoreSettingsSchema.safeParse(merged);
    return ok.success ? ok.data : DEFAULT_SETTINGS;
  } catch (e) {
    console.error("getStoreSettings", e);
    return DEFAULT_SETTINGS;
  }
}

export async function saveStoreSettings(s: StoreSettings) {
  const pairs: [string, unknown][] = [
    [KEYS.business, s.business],
    [KEYS.shipping, s.shipping],
    [KEYS.announcement, s.announcement],
    [KEYS.socials, s.socials],
    [KEYS.lowStockThreshold, s.lowStockThreshold],
  ];
  await db().query("INSERT INTO settings (`key`, value) VALUES ? ON DUPLICATE KEY UPDATE value = VALUES(value)", [
    pairs.map(([k, v]) => [k, JSON.stringify(v)]),
  ]);
}

/** Today's announcement messages. Date check runs inside the cache (refreshed hourly), not during render. */
export async function getLiveAnnouncements() {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);
  const s = await getStoreSettings();
  return { items: liveAnnouncements(s), intervalSec: s.announcement.intervalSec };
}
