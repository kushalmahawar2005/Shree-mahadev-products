import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { DEFAULT_SETTINGS, liveAnnouncements, StoreSettingsSchema, type StoreSettings } from "@/lib/store-settings";
import { db } from "./db";

export const SETTINGS_TAG = "settings";
const KEYS = { business: "business", pricesIncludeGst: "prices_include_gst", shipping: "shipping", announcement: "announcement", socials: "socials", lowStockThreshold: "low_stock_threshold", paymentGateway: "payment_gateway" } as const;

async function readRaw(): Promise<Partial<Record<keyof typeof KEYS, unknown>>> {
  const [rows] = await db().query<RowDataPacket[]>("SELECT `key`, value FROM settings WHERE `key` IN (?)", [Object.values(KEYS)]);
  // mysql2 already parses JSON columns, so a JSON string value ("cashfree") arrives as a plain string.
  // Only parse what still looks like raw JSON text; never let one value break every setting.
  const parse = (v: unknown) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  };
  const byKey = new Map(rows.map((r) => [r.key as string, parse(r.value)]));
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
      pricesIncludeGst: raw.pricesIncludeGst === undefined ? true : raw.pricesIncludeGst === true,
      shipping: { ...DEFAULT_SETTINGS.shipping, ...(raw.shipping as object) },
      announcement: (raw.announcement as StoreSettings["announcement"]) ?? DEFAULT_SETTINGS.announcement,
      socials: (raw.socials as StoreSettings["socials"]) ?? DEFAULT_SETTINGS.socials,
      lowStockThreshold: (raw.lowStockThreshold as number) ?? DEFAULT_SETTINGS.lowStockThreshold,
      paymentGateway: raw.paymentGateway === "cashfree" ? "cashfree" : "payu",
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
    [KEYS.pricesIncludeGst, s.pricesIncludeGst],
    [KEYS.shipping, s.shipping],
    [KEYS.announcement, s.announcement],
    [KEYS.socials, s.socials],
    [KEYS.lowStockThreshold, s.lowStockThreshold],
    [KEYS.paymentGateway, s.paymentGateway],
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
