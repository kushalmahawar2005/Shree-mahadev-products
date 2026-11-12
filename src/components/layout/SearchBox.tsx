"use client";

import { thumbUrl } from "@/lib/image-loader";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, TrendingUp } from "lucide-react";
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
  const [hoverCat, setHoverCat] = useState<string | null>(null);
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
  const cat = categories.find((c) => c.href === hoverCat);
  const catHandle = cat?.href.split("/").pop();
  const matches = term
    ? all
        .filter((p) => `${p.title} ${p.titleHi}`.toLowerCase().includes(term))
        .slice(0, 4)
    : cat
      ? all.filter((p) => p.collections?.includes(catHandle!)).slice(0, 4)
      : recommended.slice(0, 4);

  return (
    <div ref={wrap} className={cn("relative hidden lg:block", open && "z-30")}>
      <form
        action="/search"
        role="search"
        onSubmit={(e) => {
          // Empty search: stay here and open the suggestions instead of a separate search page.
          if (!q.trim()) {
            e.preventDefault();
            document.getElementById("header-search")?.focus();
            setOpen("both");
          }
        }}
        className={cn(
          "relative flex h-11 w-full items-center rounded-full border bg-white pr-1.5 pl-4 transition-[border-color,box-shadow,background-color] hover:border-forest/20 focus-within:border-forest focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(180,144,36,0.18)]",
          open ? "border-forest bg-white" : "border-line",
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
          placeholder=""
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none focus-visible:outline-none"
        />
        {!q && <RotatingHint />}
        <button
          type="submit"
          aria-label="Search"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-forest-mid"
        >
          <SearchIcon className="size-4" />
        </button>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top left" }}
            className={cn(
              "absolute top-full left-0 z-20 mt-3 flex overflow-hidden rounded-3xl border border-line bg-white shadow-[0_30px_60px_-25px_rgba(7,47,27,0.45)]",
              open === "both" ? "w-[min(820px,calc(100vw-4rem))]" : "w-[260px]",
            )}
          >
            {/* Categories */}
            <div className="flex w-[240px] shrink-0 flex-col bg-[linear-gradient(180deg,#fbf7ef_0%,#f6efe2_100%)] p-3">
              <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase">Categories</p>
              <ul className="space-y-0.5" onMouseLeave={() => setHoverCat(null)}>
                {categories.map((c) => {
                  const p = byHandle.get(c.handle);
                  const on = hoverCat === c.href;
                  return (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        onClick={() => setOpen(null)}
                        onMouseEnter={() => setHoverCat(c.href)}
                        onFocus={() => setHoverCat(c.href)}
                        className={cn(
                          "group/c flex h-11 items-center gap-3 rounded-xl px-2 text-sm font-medium text-forest-text transition-colors",
                          on ? "bg-white shadow-sm" : "hover:bg-white/70",
                        )}
                      >
                        <span
                          className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full"
                          style={{ backgroundColor: p?.swatch ? `${p.swatch}55` : undefined }}
                        >
                          {p?.image && <Image src={thumbUrl(p.image, 24)} alt="" width={24} height={24} unoptimized className="size-6 object-contain" />}
                        </span>
                        <span className="flex-1">{c.label}</span>
                        <ArrowRight className={cn("size-3.5 transition-all", on ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0")} aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/shop"
                onClick={() => setOpen(null)}
                className="mt-auto flex items-center justify-center gap-1.5 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid"
              >
                Shop all products <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>

            {/* Results */}
            {open === "both" && (
              <div className="min-w-0 flex-1 p-5">
                {!term && !cat && (
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted">
                      <TrendingUp className="size-3.5 text-sale" aria-hidden /> Popular
                    </span>
                    {["mustard oil", "groundnut oil", "raw honey", "desi khand"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setQ(t)}
                        className="rounded-full border border-line px-3 py-1 text-xs font-medium text-forest-text transition-colors hover:border-forest/40 hover:bg-khaki-soft"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="font-bold text-forest-text">{term ? `Results for “${q.trim()}”` : cat ? cat.label : "Recommended for you"}</p>
                  {(cat || term) && (
                    <Link
                      href={term ? `/search?q=${encodeURIComponent(q.trim())}` : cat!.href}
                      onClick={() => setOpen(null)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
                    >
                      View all <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  )}
                </div>
                {matches.length === 0 ? (
                  <p className="rounded-2xl bg-subtle px-4 py-8 text-center text-sm text-ink-muted">No products found. Try another word.</p>
                ) : (
                  <motion.ul
                    key={term || cat?.href || "rec"}
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                    className="grid grid-cols-2 gap-2.5"
                  >
                    {matches.map((p) => (
                      <motion.li key={p.handle} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}>
                        <Link
                          href={`/products/${p.handle}`}
                          onClick={() => setOpen(null)}
                          className="group/p flex h-full items-center gap-3 rounded-2xl border border-line p-2.5 transition-all hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-[0_12px_24px_-16px_rgba(7,47,27,0.45)]"
                        >
                          <span
                            className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl"
                            style={{ background: p.swatch ? `radial-gradient(circle at 50% 60%, ${p.swatch}66, ${p.swatch}1a 70%)` : undefined }}
                          >
                            {p.image && (
                              <Image src={thumbUrl(p.image, 56)} alt="" width={56} height={56} unoptimized className="size-14 object-contain transition-transform duration-300 group-hover/p:scale-110" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-forest-text">{shortName(p.title)}</span>
                            <span className="block truncate text-xs text-ink-muted" lang="hi">
                              {p.titleHi}
                            </span>
                            {p.from ? <span className="mt-1 block text-sm font-bold text-sale">from {formatMoney(p.from)}</span> : null}
                          </span>
                        </Link>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const HINTS = ["groundnut oil", "mustard oil", "raw honey", "desi khand", "coconut oil"];

/** Placeholder that cycles product names (decorative; the input keeps its label). */
function RotatingHint() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % HINTS.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <span aria-hidden className="pointer-events-none absolute left-4 flex h-full items-center gap-1 overflow-hidden text-[15px] text-ink-muted">
      Search for
      {/* Old and new word share one grid cell and cross-fade, so the slot is never empty. */}
      <span className="relative inline-grid">
        <AnimatePresence initial={false}>
          <motion.span
            key={i}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="font-medium whitespace-nowrap text-forest-text [grid-area:1/1]"
          >
            {HINTS[i]}…
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
