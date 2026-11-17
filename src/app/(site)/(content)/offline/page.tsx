import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { site } from "@/data/site";

export const metadata: Metadata = { title: "You're offline", robots: { index: false, follow: false } };

/** Shown by the service worker when a page can't load (no internet). Cached once at install. */
export default function OfflinePage() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center md:py-28">
      <span className="grid size-16 place-items-center rounded-full bg-khaki-soft text-forest">
        <WifiOff className="size-7" />
      </span>
      <h1 className="mt-5 text-3xl">You&apos;re offline</h1>
      <p className="mt-2 text-ink-muted">Check your internet connection and try again. Your cart is saved and will be here when you&apos;re back.</p>
      {/* Plain reload that works without JavaScript. */}
      <form method="get">
        <button type="submit" className="mt-6 inline-flex h-12 items-center rounded-full bg-forest px-7 text-sm font-bold text-white hover:bg-forest-mid">
          Try again
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-muted">
        Need help? Call <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-forest">{site.phone}</a>
      </p>
    </section>
  );
}
