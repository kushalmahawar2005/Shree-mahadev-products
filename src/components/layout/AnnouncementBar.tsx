import { getLiveAnnouncements } from "@/lib/server/store-settings";
import { AnnouncementStrip } from "./AnnouncementStrip";

/**
 * Top strip. Messages, links and schedule come from /admin/settings.
 * Write "… code WELCOME10" in a message to show a copyable coupon chip.
 */
export async function AnnouncementBar() {
  const live = await getLiveAnnouncements();
  if (!live.items.length) return null;
  return <AnnouncementStrip items={live.items.map((m) => ({ text: m.text, href: m.href ?? "" }))} intervalSec={live.intervalSec} />;
}
