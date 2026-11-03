"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { MenuGroup } from "@/data/site";

export type MenuProduct = {
  handle: string;
  title: string;
  titleHi: string;
  swatch?: string;
  image?: string;
  from?: number;
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

/** Cowberry-style: panel expands inside the header card, round image tiles + "All" link. */
export function MegaMenu({
  open,
  data,
  onNavigate,
}: {
  open: MenuGroup | null;
  data: MenuData;
  onNavigate: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="mega"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="hidden overflow-hidden lg:block"
        >
          <div className="mx-auto max-w-[1360px] px-3 pb-3">
            <div className="rounded-2xl bg-khaki-soft px-8 py-7">
              <div className="flex items-center gap-8">
                <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(120px,1fr))] justify-items-center gap-x-4 gap-y-6">
                  {data[open].map((o) => (
                    <Link
                      key={o.handle}
                      href={`/products/${o.handle}`}
                      onClick={onNavigate}
                      className="group/tile flex w-full max-w-[140px] flex-col items-center gap-3 text-center"
                    >
                      <span
                        className="grid size-24 place-items-center overflow-hidden rounded-full ring-1 ring-black/5 transition-transform duration-300 group-hover/tile:scale-105"
                        style={{
                          backgroundColor: o.swatch
                            ? `${o.swatch}55`
                            : undefined,
                        }}
                      >
                        {o.image && (
                          <Image
                            src={o.image}
                            alt=""
                            width={72}
                            height={72}
                            unoptimized
                            className="size-[72px] object-contain"
                          />
                        )}
                      </span>
                      <span className="text-[17px] leading-snug font-medium text-forest-text group-hover/tile:text-forest">
                        {shortName(o.title)}
                        <span
                          className="block text-sm text-ink-muted"
                          lang="hi"
                        >
                          {o.titleHi}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="flex min-h-24 shrink-0 items-center gap-8 pl-2">
                  <span
                    className="h-24 w-0.5 rounded-full bg-forest"
                    aria-hidden
                  />
                  <div className="flex flex-col items-start gap-2">
                    <Link
                      href={panels[open].all[1]}
                      onClick={onNavigate}
                      className="inline-flex items-center gap-2 text-lg font-semibold text-forest hover:underline"
                    >
                      {panels[open].all[0]} <span aria-hidden>→</span>
                    </Link>
                    {panels[open].extra.map(([label, href]) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={onNavigate}
                        className="text-[15px] text-forest-text hover:text-forest hover:underline"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
