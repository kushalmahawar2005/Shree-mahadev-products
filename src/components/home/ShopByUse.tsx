"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Baby, Cookie, CookingPot, Flame, Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PickCard, type PickProduct } from "./PickCard";

export type UseTab = {
  key: string;
  label: string;
  labelHi: string;
  note: string;
  tip: string;
  viewAll: string;
  products: PickProduct[];
};

const ICONS: Record<string, typeof Flame> = {
  "daily-cooking": CookingPot,
  "deep-frying": Flame,
  "pickles-tadka": Cookie,
  "hair-skin": Sparkles,
  "baby-massage": Baby,
};

/**
 * "Shop by use": large icon cards pick the use; a forest story panel explains it (Hindi name,
 * kitchen tip) next to that use's products, which slide in. Mobile: chips scroll, panel stacks.
 */
export function ShopByUse({ tabs }: { tabs: UseTab[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const tab = tabs[active];
  const Icon = ICONS[tab.key] ?? CookingPot;

  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
  }, [active]);

  return (
    <section className="paper-grain relative overflow-hidden bg-[#F5EDDE] pt-4 pb-14 md:pt-6 md:pb-20">
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <div className="mb-8 flex flex-col items-center gap-2 text-center md:mb-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">
            <span className="size-1.5 rounded-full bg-mustard" /> One oil doesn&apos;t fit every dish
          </p>
          <h2 className="text-3xl md:text-[44px]">Shop by use</h2>
          <p className="max-w-xl text-ink-muted">Tell us what you&apos;re cooking. We&apos;ll show the oil that suits it.</p>
        </div>

        {/* Use picker: one pill rail, forest highlight slides between uses */}
        <div className="-mx-4 flex justify-start overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:justify-center md:px-0">
          <div role="tablist" aria-label="Shop by use" className="flex w-max gap-0.5 rounded-full border border-line/80 bg-white/70 p-1 backdrop-blur">
            {tabs.map((t, i) => {
              const I = ICONS[t.key] ?? CookingPot;
              const on = i === active;
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setActive(i)}
                  className="relative flex items-center gap-2 rounded-full px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
                >
                  {on && (
                    <motion.span
                      layoutId="use-pill"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-forest"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className={cn("relative shrink-0 transition-colors", on ? "text-[#e8c879]" : "text-forest/70")}>
                    <I className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="relative leading-tight">
                    <span className={cn("block text-sm font-bold whitespace-nowrap transition-colors", on ? "text-white" : "text-forest-text")}>{t.label}</span>
                    <span className={cn("font-hindi block text-[13px] whitespace-nowrap transition-colors", on ? "text-[#e8c879]" : "text-sale")} lang="hi">
                      {t.labelHi}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr] lg:gap-5">
          {/* Story panel */}
            <motion.aside
              key={tab.key}
              initial={reduce ? false : { opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="relative flex flex-col overflow-hidden rounded-3xl bg-forest p-6 text-white"
            >
              <Icon aria-hidden className="absolute -right-6 -bottom-6 size-44 text-white/[0.06]" strokeWidth={1.25} />
              <span className="relative grid size-12 place-items-center rounded-2xl bg-white/10 text-[#e8c879]">
                <Icon className="size-6" />
              </span>
              <p className="font-hindi relative mt-5 text-lg text-[#e8c879]" lang="hi">
                {tab.labelHi}
              </p>
              <h3 className="relative text-2xl text-white md:text-3xl">{tab.label}</h3>
              <p className="relative mt-1 text-sm text-white/70">{tab.note}</p>
              <p className="relative mt-5 flex gap-2.5 rounded-2xl bg-white/10 p-3.5 text-sm leading-relaxed text-white/90">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#e8c879]" aria-hidden />
                {tab.tip}
              </p>
              <Link
                href={tab.viewAll}
                className="btn-shine relative mt-6 inline-flex h-11 items-center justify-center gap-2 self-start overflow-hidden rounded-full bg-[#e8c879] px-5 text-sm font-bold text-forest-deep transition-colors hover:bg-white lg:mt-auto"
              >
                Shop all for {tab.label.toLowerCase()} <ArrowRight className="size-4" />
              </Link>
            </motion.aside>

          {/* Products for this use */}
          <div ref={track} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:gap-4 lg:mx-0 lg:px-0">
            {tab.products.length === 0 ? (
              <p className="grid w-full place-items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-sm text-ink-muted">Products for this use are coming soon.</p>
            ) : (
              tab.products.map((p) => (
                <motion.div
                  key={`${tab.key}-${p.handle}`}
                  initial={reduce ? false : { opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-[46%] shrink-0 snap-start sm:w-[32%] lg:w-[calc((100%-3rem)/3.2)]"
                >
                  <PickCard product={p} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
