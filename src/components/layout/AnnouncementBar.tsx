import { Ticker } from "@/components/motion/Ticker";
import { announcements } from "@/data/site";

/** Scrolling ticker on every screen size. */
export function AnnouncementBar() {
  return (
    <div className="overflow-hidden bg-forest-deep text-sm font-medium text-white">
      <Ticker
        items={announcements}
        duration={36}
        className="flex h-9 items-center"
        separator={<span className="inline-block size-1.5 rounded-full bg-mustard" />}
      />
    </div>
  );
}
