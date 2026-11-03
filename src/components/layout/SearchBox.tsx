"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";
import { SearchIcon } from "./icons";
import type { MenuProduct } from "./MegaMenu";

const categories = [
  {
    label: "Wood Pressed Oils",
    href: "/collections/wood-pressed-oils",
    handle: "groundnut-oil",
  },
  {
    label: "Cooking Oils",
    href: "/collections/cooking-oils",
    handle: "yellow-mustard-oil",
  },
  {
    label: "Wellness Oils",
    href: "/collections/wellness-oils",
    handle: "almond-oil",
  },
  {
    label: "Raw Honey",
    href: "/collections/raw-honey",
    handle: "jamun-raw-honey",
  },
  {
    label: "Natural Sweeteners",
    href: "/collections/natural-sweeteners",
    handle: "jaggery-powder",
  },
  {
    label: "Bulk Tins",
    href: "/collections/bulk-tins",
    handle: "black-sesame-oil",
  },
];

const shortName = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/** Two Brothers-style slim search box; focus opens recommended products + category list. */
export function SearchBox({
  recommended,
  all,
}: {
  recommended: MenuProduct[];
  all: MenuProduct[];
}) {
  const [open, setOpen] = useState<null | "both" | "cats">(null);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      !wrap.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const byHandle = useMemo(() => new Map(all.map((p) => [p.handle, p])), [all]);
  const term = q.trim().toLowerCase();
  const matches = term
    ? all
        .filter((p) => `${p.title} ${p.titleHi}`.toLowerCase().includes(term))
        .slice(0, 4)
    : recommended.slice(0, 4);

  return (
    <div ref={wrap} className={cn("relative hidden lg:block", open && "z-30")}>
      <form
        action="/search"
        role="search"
        className={cn(
          "flex h-11 w-full items-center rounded-lg border bg-white pr-1 pl-4 transition-colors",
          open ? "border-forest" : "border-forest-text/30",
        )}
      >
        <label htmlFor="header-search" className="sr-only">
          Search products
        </label>
        <input
          id="header-search"
          name="q"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen("both");
          }}
          onFocus={() => setOpen("both")}
          placeholder="Search for groundnut oil"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="grid size-9 shrink-0 place-items-center text-forest-text"
        >
          <SearchIcon className="size-5" />
        </button>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full left-0 z-20 mt-2 flex w-[min(860px,calc(100vw-4rem))] items-start justify-between gap-4"
          >
            {open === "both" && (
              <div className="flex-1 rounded-[20px] bg-white p-6 shadow-[0_20px_40px_-20px_rgba(7,47,27,0.4)]">
                <p className="mb-4 text-xl font-bold text-forest-text">
                  {term ? "Matching Products" : "Recommended Products"}
                </p>
                {matches.length === 0 ? (
                  <p className="text-ink-muted">
                    No products found. Try another word.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-4">
                    {matches.map((p) => (
                      <li key={p.handle}>
                        <Link
                          href={`/products/${p.handle}`}
                          onClick={() => setOpen(null)}
                          className="flex h-full items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:border-forest"
                        >
                          <span
                            className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg"
                            style={{
                              backgroundColor: p.swatch
                                ? `${p.swatch}44`
                                : undefined,
                            }}
                          >
                            {p.image && (
                              <Image
                                src={p.image}
                                alt=""
                                width={64}
                                height={64}
                                unoptimized
                                className="size-16 object-contain"
                              />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-forest-text">
                              {shortName(p.title)}
                            </span>
                            {p.from ? (
                              <span className="mt-1 block text-lg font-bold text-forest-text">
                                {formatMoney(p.from)}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div
              className={cn(
                "w-[260px] shrink-0 overflow-hidden rounded-[20px] bg-white shadow-[0_20px_40px_-20px_rgba(7,47,27,0.4)]",
                open === "cats" && "ml-auto",
              )}
            >
              <ul className="p-2">
                {categories.map((c) => {
                  const p = byHandle.get(c.handle);
                  return (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        onClick={() => setOpen(null)}
                        className="flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium text-forest-text transition-colors hover:bg-khaki-soft"
                      >
                        <span
                          className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full"
                          style={{
                            backgroundColor: p?.swatch
                              ? `${p.swatch}66`
                              : undefined,
                          }}
                        >
                          {p?.image && (
                            <Image
                              src={p.image}
                              alt=""
                              width={28}
                              height={28}
                              unoptimized
                              className="size-7 object-contain"
                            />
                          )}
                        </span>
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/shop"
                onClick={() => setOpen(null)}
                className="block bg-forest py-3 text-center text-lg font-semibold text-white transition-colors hover:bg-forest-mid"
              >
                View All Categories
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
