import Link from "next/link";
import { Ticker } from "@/components/motion/Ticker";
import { getLiveAnnouncements } from "@/lib/server/store-settings";

/** Scrolling ticker on every screen size. Messages, links and schedule come from /admin/settings. */
export async function AnnouncementBar() {
  const live = await getLiveAnnouncements();
  const items = live.items.map((m) =>
    m.href ? (
      <Link key={m.text} href={m.href} className="underline-offset-2 hover:underline">
        {m.text}
      </Link>
    ) : (
      m.text
    ),
  );
  if (!items.length) return null;
  return (
    <div className="overflow-hidden bg-forest-deep text-sm font-medium text-white">
      <Ticker
        items={items}
        duration={Math.max(18, live.intervalSec * 9)}
        className="flex h-9 items-center"
        separator={<span className="inline-block size-1.5 rounded-full bg-mustard" />}
      />
    </div>
  );
}
