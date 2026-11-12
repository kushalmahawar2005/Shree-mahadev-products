import { cacheLife } from "next/cache";
import { site } from "@/data/site";
import { HomeOnly } from "./HomeOnly";

/** Is today (IST) inside the configured festive window? Cached, so it re-checks every few hours. */
async function festiveActive(): Promise<boolean> {
  "use cache";
  cacheLife("hours");
  const { enabled, start, end } = site.festive;
  if (!enabled) return false;
  const now = Date.now();
  return now >= Date.parse(`${start}T00:00:00+05:30`) && now <= Date.parse(`${end}T23:59:59+05:30`);
}

/**
 * Seasonal marigold toran, rendered once (home page only) right under the header. It takes no layout
 * space (zero-height wrapper) and hangs over the top of the first section, purely decorative.
 * Uses the local copy with the painted cream gaps keyed out, tiled with repeat-x.
 */
export async function FestiveToran() {
  if (!(await festiveActive())) return null;
  // Home page only: on inner pages it hung over the page heading (checkout, product pages).
  return (
    <HomeOnly>
    <div aria-hidden className="pointer-events-none relative z-30 h-0 select-none">
      <div className="absolute inset-x-0 top-0 h-12 bg-[url('/images/home/toran-clean.webp')] bg-[length:auto_48px] bg-top bg-repeat-x md:h-20 md:bg-[length:auto_80px]" />
    </div>
    </HomeOnly>
  );
}
