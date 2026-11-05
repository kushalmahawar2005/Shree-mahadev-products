"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Boxes, PlayCircle } from "lucide-react";
import { formatMoney } from "@/lib/utils/money";
import type { MenuGroup } from "@/data/site";

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

const panels: Record<
  MenuGroup,
  { all: [string, string]; extra: [string, string][] }
> = {
  oils: {
    all: ["All Oils", "/collections/wood-pressed-oils"],
    extra: [
      ["Cooking oils", "/collections/cooking-oils"],
      ["Wellness oils", "/collections/wellness-oils"],
      ["Bulk tins (5L / 15L)", "/collections/bulk-tins"],
      ["How our ghani works", "/our-ghani"],
    ],
  },
  honey: { all: ["All Honey", "/collections/raw-honey"], extra: [] },
  sweeteners: {
    all: ["All Sweeteners", "/collections/natural-sweeteners"],
    extra: [],
  },
};

/** Mega menu: product cards (stagger in) + "shop by" links and feature cards on the side. */
export function MegaMenu({
  open,
  data,
  collections,
  onNavigate,
}: {
  open: MenuGroup | null;
  data: MenuData;
  collections: { handle: string; title: string }[];
  onNavigate: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="mega"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="hidden pt-2 lg:block"
        >
          <div className="mx-auto max-w-[1360px] px-3 pb-4 lg:px-8">
            <div className="grid grid-cols-[1fr_280px] gap-6 rounded-3xl border border-line bg-[linear-gradient(180deg,#fbf7ef_0%,#f6efe2_100%)] p-6 shadow-[0_30px_60px_-30px_rgba(7,47,27,0.35)]">
              {/* Product cards */}
              <motion.ul
                key={open}
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.03 } } }}
                className="grid grid-cols-6 content-start gap-2.5 self-start"
              >
                {data[open].map((o) => (
                  <motion.li
                    key={o.handle}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } }}
                  >
                    <Link
                      href={`/products/${o.handle}`}
                      onClick={onNavigate}
                      className="group/tile relative flex h-full flex-col items-center rounded-2xl border border-transparent bg-white/70 p-2.5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-line hover:bg-white hover:shadow-[0_16px_30px_-18px_rgba(7,47,27,0.45)]"
                    >
                      <span
                        className="relative grid h-20 w-full place-items-center overflow-hidden rounded-xl"
                        style={{ background: o.swatch ? `radial-gradient(circle at 50% 60%, ${o.swatch}66 0%, ${o.swatch}1a 60%, transparent 75%)` : undefined }}
                      >
                        {o.image && (
                          <Image
                            src={o.image}
                            alt=""
                            width={80}
                            height={80}
                            unoptimized
                            className="size-16 object-contain transition-transform duration-500 group-hover/tile:scale-110 group-hover/tile:-rotate-3"
                          />
                        )}
                      </span>
                      <span className="mt-1.5 text-sm leading-snug font-semibold text-forest-text">{shortName(o.title)}</span>
                      <span className="text-xs text-ink-muted" lang="hi">
                        {o.titleHi}
                      </span>
                      {o.from ? <span className="mt-1.5 text-xs font-semibold text-sale">from {formatMoney(o.from)}</span> : null}
                      <ArrowUpRight className="absolute top-2.5 right-2.5 size-4 text-forest opacity-0 transition-opacity group-hover/tile:opacity-100" aria-hidden />
                    </Link>
                  </motion.li>
                ))}
              </motion.ul>

              {/* Side: shop-by links + feature card */}
              <div className="flex flex-col gap-4 border-l border-line pl-6">
                <Link
                  href={panels[open].all[1]}
                  onClick={onNavigate}
                  className="group/all inline-flex items-center justify-between rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid"
                >
                  {panels[open].all[0]}
                  <ArrowRight className="size-4 transition-transform group-hover/all:translate-x-0.5" aria-hidden />
                </Link>
                <div>
                  <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase">Shop by</p>
                  <ul className="space-y-0.5">
                    {[...collections.map((c) => [c.title, `/collections/${c.handle}`] as [string, string]), ...panels[open].extra.filter(([, h]) => !h.startsWith("/our-ghani") && !h.includes("bulk"))].map(([label, href]) => (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={onNavigate}
                          className="group/l flex items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-forest-text transition-colors hover:bg-white hover:text-forest"
                        >
                          {label}
                          <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover/l:translate-x-0 group-hover/l:opacity-100" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                {open === "oils" && (
                  <div className="mt-auto grid gap-2">
                    <Link href="/collections/bulk-tins" onClick={onNavigate} className="group/c flex items-center gap-3 rounded-2xl bg-forest p-3 text-white">
                      <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-mustard">
                        <Boxes className="size-5" aria-hidden />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">Bulk tins · 5 L / 15 L</span>
                        <span className="block text-xs text-white/70">For families, shops & hotels</span>
                      </span>
                      <ArrowRight className="size-4 transition-transform group-hover/c:translate-x-0.5" aria-hidden />
                    </Link>
                    <Link href="/our-ghani" onClick={onNavigate} className="group/c flex items-center gap-3 rounded-2xl border border-line bg-white p-3 text-forest-text hover:border-forest/30">
                      <span className="grid size-10 place-items-center rounded-xl bg-khaki-soft text-forest">
                        <PlayCircle className="size-5" aria-hidden />
                      </span>
                      <span className="flex-1 text-sm font-semibold">How our ghani works</span>
                      <ArrowRight className="size-4 transition-transform group-hover/c:translate-x-0.5" aria-hidden />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
