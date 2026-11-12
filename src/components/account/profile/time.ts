import { formatDateTime } from "@/lib/utils/format";

/** "Active now" / "5 min ago" / "3 h ago" / date. Runs on the server (IST DB strings). */
export function relativeTime(raw: string, now = Date.now()): string {
  const d = new Date(`${raw.replace(" ", "T")}+05:30`);
  const mins = Math.floor((now - d.getTime()) / 60000);
  if (Number.isNaN(mins)) return raw;
  if (mins < 5) return "Active now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDateTime(raw, { time: false });
}
