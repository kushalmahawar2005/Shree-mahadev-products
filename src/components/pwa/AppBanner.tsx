"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { BellRing, Download, Repeat2, Smartphone, Zap } from "lucide-react";
import { InstallApp } from "./InstallApp";
import { usePwaInstall } from "./pwa-store";
import { cn } from "@/lib/utils/cn";

const LOGO = "https://res.cloudinary.com/bmqxsylj/image/upload/f_auto,q_auto:good,c_limit,w_160/v1793735979/swadeshi-mahadev/static/logo.png";

const PERKS = [
  { icon: Repeat2, label: "1-tap reorder", hint: "Your usual order again in seconds" },
  { icon: BellRing, label: "Live order tracking", hint: "Know exactly where your parcel is" },
  { icon: Zap, label: "Opens instantly", hint: "Light, fast, no app store needed" },
];

/**
 * "Download the Mahadev app" card. The button installs the PWA (Chrome / Edge / Android) or opens the
 * iPhone Add-to-Home-Screen guide. Hidden once installed or in browsers that can't install apps.
 *
 * placement "footer": above the footer on every page (on the home page only from md up, because
 * phones see the "home" copy higher up). placement "home": phones only, above Refined vs Kachi Ghani.
 */
export function AppBanner({ placement = "footer" }: { placement?: "footer" | "home" }) {
  const { state } = usePwaInstall();
  const pathname = usePathname();
  if (state === "hidden") return null;
  const isHome = placement === "home";
  return (
    <section
      aria-label="Get the Mahadev app"
      className={cn(
        "px-4 md:px-8",
        isHome ? "pt-2 pb-8 md:hidden" : "pt-4 pb-10 md:pb-14",
        !isHome && pathname === "/" && "max-md:hidden",
      )}
    >
      <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#fbf3de] via-[#f5e4b9] to-[#ecd296] shadow-[0_10px_30px_-12px_rgba(90,60,10,0.35)] ring-1 ring-[#d4b062]/70">
        {/* Soft decoration: gold glow + dotted arc, purely visual */}
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-[#e2b23a]/25 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-12 size-52 rounded-full bg-forest/10 blur-2xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(#9a6a12_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(90deg,transparent,black_60%)]"
        />

        <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-4 p-4 sm:gap-x-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:px-8 lg:grid-cols-[auto_minmax(0,0.9fr)_minmax(0,1.3fr)_auto] lg:gap-x-8">
          <div className="relative shrink-0">
            <div className="grid size-14 place-items-center rounded-2xl bg-white shadow-md ring-1 ring-[#d4b062]/50 sm:size-[72px]">
              <Image src={LOGO} alt="" width={72} height={72} unoptimized className="size-11 sm:size-14" />
            </div>
            <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-forest-deep text-white ring-2 ring-[#fbf3de] sm:size-7">
              <Smartphone className="size-3.5" />
            </span>
          </div>

          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-forest-deep px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase sm:text-[11px]">
              New · Free
            </span>
            <p className="mt-1.5 text-lg leading-tight font-bold tracking-tight text-forest-deep sm:text-2xl">
              Get the <span className="bg-gradient-to-r from-[#c9921f] to-[#8a5b0c] bg-clip-text text-transparent">Mahadev app</span>
            </p>
            <p className="mt-1 text-xs text-ink-muted sm:text-sm">No app store, no space used. Install in one tap.</p>
          </div>

          {/* Perks: their own column on wide screens so the middle of the card isn't empty */}
          <ul className="hidden grid-cols-3 divide-x divide-[#d4b062]/50 rounded-2xl bg-white/60 py-3 ring-1 ring-[#d4b062]/40 lg:grid">
            {PERKS.map(({ icon: Icon, label, hint }) => (
              <li key={label} className="flex items-start gap-2.5 px-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-deep/10 text-forest-deep">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] leading-tight font-semibold text-forest-deep">{label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{hint}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="col-span-2 flex flex-col items-stretch gap-1.5 md:col-span-1 md:items-center">
            <InstallApp className="app-shake btn-shine relative h-11 w-full shrink-0 justify-center overflow-hidden rounded-full bg-forest-deep px-6 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(20,60,30,0.6)] ring-2 ring-[#e2b23a]/70 transition-colors hover:bg-forest sm:h-12 md:w-auto md:px-7">
              <Download className="size-4" /> Download now
            </InstallApp>
            <span className="text-center text-[11px] text-ink-muted">Android &amp; iPhone</span>
          </div>
        </div>
      </div>
    </section>
  );
}
