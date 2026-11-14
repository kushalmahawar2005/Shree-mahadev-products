"use client";

import { thumbUrl } from "@/lib/image-loader";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { shopByUse, type MenuGroup } from "@/data/site";

export type MenuProduct = {
  handle: string;
  title: string;
  titleHi: string;
  swatch?: string;
  image?: string;
  from?: number;
  /** Collection handles this product belongs to (search dropdown hover preview). */
  collections?: string[];
};
export type MenuData = Record<MenuGroup, MenuProduct[]>;

const shortName = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

type Promo = { title: string; text: string; cta: string; href: string; img: string };
const PANELS: Record<MenuGroup, { all: [string, string]; useLinks: boolean; promo: Promo }> = {
  oils: {
    all: ["All oils", "/collections/wood-pressed-oils"],
    useLinks: true,
    promo: { title: "How our ghani works", text: "Six honest steps, from farm to bottle.", cta: "See the process", href: "/#ghani-process", img: "/illustrations/process/3-wood-pressed.webp" },
  },
  honey: {
    all: ["All honey", "/collections/raw-honey"],
    useLinks: false,
    promo: { title: "Bulk orders", text: "5 L / 15 L tins for families, shops and hotels.", cta: "Get a quote", href: "/bulk-orders", img: "/illustrations/process/5-bottled.webp" },
  },
  sweeteners: {
    all: ["All sweeteners", "/collections/natural-sweeteners"],
    useLinks: false,
    promo: { title: "Bulk orders", text: "Family packs and shop orders, at tin prices.", cta: "Get a quote", href: "/bulk-orders", img: "/illustrations/process/5-bottled.webp" },
  },
};

/**
 * Mega menu: product tiles (stagger in) + a side column with "All …", Shop-by-use links (oils) and a
 * featured promo card. The panel is as wide as its content (no empty area for short menus).
 * Fade + 8px slide. Keyboard: it opens from the nav (Enter / ↓), Escape closes (see Header).
 */
export function MegaMenu({ open, data, onNavigate }: { open: MenuGroup | null; data: MenuData; onNavigate: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="mega"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="hidden pt-2 lg:block"
        >
          <div className="mx-auto max-w-[1360px] px-8 pb-4">
            <div
              data-mega-panel=""
              role="region"
              aria-label={PANELS[open].all[0]}
              className="mx-auto flex w-fit max-w-full gap-6 rounded-3xl border border-line bg-[linear-gradient(180deg,#fbf7ef_0%,#f6efe2_100%)] p-6 shadow-[0_18px_30px_-18px_rgba(20,20,10,0.25)]"
            >
              {/* Product tiles: as many columns as products (max 6), equal heights */}
              <motion.ul
                key={open}
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.03 } } }}
                className="grid auto-rows-fr content-start gap-2.5"
                style={{ gridTemplateColumns: `repeat(${Math.min(6, Math.max(1, data[open].length))}, 132px)` }}
              >
                {data[open].map((o) => (
                  <motion.li key={o.handle} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } }}>
                    <Tile o={o} onNavigate={onNavigate} />
                  </motion.li>
                ))}
              </motion.ul>

              {/* Side column */}
              <div className="flex w-[260px] shrink-0 flex-col gap-4 border-l border-line pl-6">
                <Link
                  href={PANELS[open].all[1]}
                  onClick={onNavigate}
                  className="group/all inline-flex items-center justify-between rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid"
                >
                  {PANELS[open].all[0]}
                  <ArrowRight className="size-4 transition-transform group-hover/all:translate-x-0.5" aria-hidden />
                </Link>

                {PANELS[open].useLinks && (
                  <div>
                    <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase">Shop by use</p>
                    <ul className="space-y-0.5">
                      {shopByUse.map((u) => (
                        <li key={u.tag}>
                          <Link
                            href={`/shop?use=${u.tag}`}
                            onClick={onNavigate}
                            className="group/l flex items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-forest-text transition-colors hover:bg-white hover:text-forest"
                          >
                            <span>
                              {u.label} <span className="font-hindi text-xs text-sale" lang="hi">{u.labelHi}</span>
                            </span>
                            <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover/l:translate-x-0 group-hover/l:opacity-100" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <PromoCard p={PANELS[open].promo} onNavigate={onNavigate} />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Tile({ o, onNavigate }: { o: MenuProduct; onNavigate: () => void }) {
  // Missing or broken photo: fall back to the brand mark, never an empty box.
  const [broken, setBroken] = useState(false);
  const src = o.image && !broken ? thumbUrl(o.image, 96) : "/logo.svg";
  return (
    <Link
      href={`/products/${o.handle}`}
      onClick={onNavigate}
      className="group/tile relative flex h-full flex-col items-center rounded-2xl border border-transparent bg-white/70 p-2.5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-line hover:bg-white hover:shadow-[0_16px_30px_-18px_rgba(7,47,27,0.45)]"
    >
      <span
        className="relative grid h-24 w-full place-items-center overflow-hidden rounded-xl"
        style={{ background: o.swatch ? `radial-gradient(circle at 50% 60%, ${o.swatch}66 0%, ${o.swatch}1a 60%, transparent 75%)` : undefined }}
      >
        <Image
          src={src}
          alt=""
          width={96}
          height={96}
          unoptimized
          onError={() => setBroken(true)}
          className={cn("h-20 w-auto object-contain transition-transform duration-500 group-hover/tile:scale-110 group-hover/tile:-rotate-3", src === "/logo.svg" && "h-12 opacity-60")}
        />
      </span>
      <span className="mt-1.5 text-sm leading-snug font-semibold text-forest-text">{shortName(o.title)}</span>
      <span className="font-hindi text-xs text-ink-muted" lang="hi">
        {o.titleHi}
      </span>
      <span className="mt-auto pt-1.5 text-xs font-semibold text-sale">{o.from ? `from ${formatMoney(o.from)}` : "Coming soon"}</span>
      <ArrowUpRight className="absolute top-2.5 right-2.5 size-4 text-forest opacity-0 transition-opacity group-hover/tile:opacity-100" aria-hidden />
    </Link>
  );
}

function PromoCard({ p, onNavigate }: { p: Promo; onNavigate: () => void }) {
  return (
    <Link href={p.href} onClick={onNavigate} className="group/p mt-auto flex items-center gap-3 overflow-hidden rounded-2xl bg-forest p-3 text-white">
      <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#f6efe2]">
        <Image src={p.img} alt="" width={64} height={64} className="size-14 object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{p.title}</span>
        <span className="block text-xs leading-snug text-white/75">{p.text}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#e8c879]">
          {p.cta} <ArrowRight className="size-3.5 transition-transform group-hover/p:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
