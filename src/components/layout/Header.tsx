"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BadgePercent, Boxes, Truck } from "lucide-react";
import { formatMoney } from "@/lib/utils/money";
import { StickyHeader } from "@/components/motion/StickyHeader";
import { useCart } from "@/components/cart/CartProvider";
import type { MenuGroup, NavItem } from "@/data/site";
import { cn } from "@/lib/utils/cn";
import { BagIcon, ChevronDown, MenuIcon, SearchIcon, UserIcon } from "./icons";
import { MegaMenu, type MenuData, type MenuProduct } from "./MegaMenu";
import { SearchBox } from "./SearchBox";
import { MobileNav } from "./MobileNav";

/**
 * Layout (Two Brothers style): full-width white header with
 *   announcement strip · search | logo | account + cart · thin rule · centred text nav.
 * Mobile: menu · logo · search + cart.
 */
export function Header({
  menus,
  nav,
  collections,
  recommended,
  announcement,
  allProducts,
}: {
  menus: MenuData;
  nav: NavItem[];
  collections: { handle: string; title: string }[];
  recommended: MenuProduct[];
  allProducts: MenuProduct[];
  /** Server-rendered announcement bar (reads store settings). */
  announcement?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mega, setMega] = useState<MenuGroup | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close menus on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMega(null);
    setMenuOpen(false);
  }

  const openMega = (g: MenuGroup) => {
    clearTimeout(closeTimer.current);
    setMega(g);
  };
  const keepMega = () => clearTimeout(closeTimer.current);
  const closeMega = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMega(null), 120);
  };

  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mega]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <StickyHeader>
        {/* Two Brothers layout: thin announcement strip · white row (search · logo · account/cart) · text nav */}
        <div
          className="relative w-full border-b border-line bg-white text-forest-text transition-[background-color,box-shadow] duration-300 group-data-[compact]/header:bg-white/85 group-data-[compact]/header:shadow-[0_10px_30px_-18px_rgba(7,47,27,0.45)] group-data-[compact]/header:backdrop-blur-md"
          onMouseLeave={closeMega}
        >
          {/* Announcement strip (collapses once the page is scrolled) */}
          <div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 group-data-[compact]/header:grid-rows-[0fr]">
            <div className="overflow-hidden">
              {announcement}
            </div>
          </div>

          {/* Main row */}
          <div className="mx-auto grid max-w-[1360px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2 transition-[padding] duration-300 sm:px-5 lg:px-8 lg:py-2.5 lg:group-data-[compact]/header:py-1.5">
            <div className="flex items-center">
              <button
                type="button"
                className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-khaki-soft lg:hidden"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <MenuIcon />
              </button>
              <div className="hidden w-full max-w-[300px] lg:block">
                <SearchBox recommended={recommended} all={allProducts} />
              </div>
            </div>

            <Link
              href="/"
              className="justify-self-center"
              aria-label="Swadeshi Mahadev Products, home"
            >
              {/* TODO(client): vector (SVG) logo for sharper rendering */}
              {/* Stamp-in on load, gentle turn on hover (badge logo has a scalloped seal edge) */}
              <motion.span
                className="block transition-transform duration-300 group-data-[compact]/header:scale-[0.85]"
                initial={{ scale: 0.7, rotate: -25, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                whileHover={{ rotate: 12, scale: 1.06 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              >
                <Image
                  src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png"
                  alt=""
                  width={80}
                  height={80}
                  priority
                  unoptimized
                  className="size-14 lg:size-[68px]"
                />
              </motion.span>
            </Link>

            <div className="flex items-center justify-end gap-1 sm:gap-2 lg:gap-3">
              <Link
                href="/search"
                className="grid size-11 place-items-center rounded-full hover:bg-khaki-soft lg:hidden"
                aria-label="Search"
              >
                <SearchIcon />
              </Link>
              <Link
                href="/bulk-orders"
                className="mr-1 hidden h-10 items-center gap-2 rounded-full border border-forest/15 bg-khaki-soft/50 pr-4 pl-1.5 text-[13px] font-semibold text-forest-text transition-colors hover:border-forest/30 hover:bg-khaki-soft xl:inline-flex"
              >
                <span className="grid size-7 place-items-center rounded-full bg-forest text-white">
                  <Boxes className="size-4" strokeWidth={1.8} aria-hidden />
                </span>
                Bulk orders
              </Link>
              <HeaderAction href="/track-order" label="Track" className="hidden lg:flex">
                <Truck className="size-[22px]" strokeWidth={1.6} aria-hidden />
              </HeaderAction>
              <HeaderAction href="/account" label="Account" className="hidden sm:flex">
                <UserIcon className="size-[22px]" />
              </HeaderAction>
              <CartButton />
            </div>
          </div>

          {/* Text nav (desktop), separated by a thin rule like Two Brothers */}
          <nav aria-label="Main" className="hidden lg:block">
            <div className="mx-auto max-w-[1360px] px-8">
              <ul className="flex items-center justify-center gap-3 border-t border-line py-1" onMouseLeave={() => setHovered(null)}>
                {/* Desktop keeps it lean: logo already goes home; About/Contact live in the footer + mobile menu. */}
                {nav.filter((item) => !["/", "/about", "/contact"].includes(item.href)).map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li
                      key={item.href}
                      className="relative"
                      onMouseEnter={() => {
                        setHovered(item.href);
                        if (item.menu) openMega(item.menu);
                        else closeMega();
                      }}
                    >
                      {hovered === item.href && (
                        <motion.span
                          layoutId="nav-hover"
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-khaki-soft"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <Link
                        href={item.href}
                        onFocus={() =>
                          item.menu ? openMega(item.menu) : setMega(null)
                        }
                        aria-expanded={
                          item.menu ? mega === item.menu : undefined
                        }
                        aria-haspopup={item.menu ? "true" : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative inline-flex min-h-10 items-center gap-1.5 px-5 text-[15px] font-semibold text-forest-text transition-colors duration-200 hover:text-forest",
                          item.icon === "bestseller" &&
                            "text-sale hover:text-sale",
                        )}
                      >
                        {item.icon === "bestseller" && <BadgePercent className="size-[18px]" strokeWidth={1.8} aria-hidden />}
                        {item.label}
                        {item.menu && (
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              mega === item.menu && "rotate-180",
                            )}
                          />
                        )}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-x-5 -bottom-1 h-0.5 origin-left rounded-full bg-mustard transition-transform duration-300",
                            active || mega === item.menu
                              ? "scale-x-100"
                              : "scale-x-0",
                          )}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>

          <div onMouseEnter={keepMega} className="absolute inset-x-0 top-full z-30">
            <MegaMenu
              open={mega}
              data={menus}
          collections={collections}
              onNavigate={() => setMega(null)}
            />
          </div>
        </div>
      </StickyHeader>

      <MobileNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        menus={menus}
        nav={nav}
      />
    </>
  );
}

/** Icon with a small caption under it on desktop (fills the header like big Indian D2C stores). */
function HeaderAction({ href, label, className, children }: { href: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group/act min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-forest transition-colors hover:bg-khaki-soft",
        className,
      )}
    >
      <span className="grid size-7 place-items-center transition-transform duration-200 group-hover/act:-translate-y-0.5">{children}</span>
      <span className="hidden text-[11px] leading-none font-semibold text-ink-muted lg:block">{label}</span>
    </Link>
  );
}

export function CartButton({ className }: { className?: string }) {
  const { cart, open, addedTick } = useCart();
  const count = cart?.totalQuantity ?? 0;
  const total = count ? formatMoney(cart?.subtotal.amount ?? 0) : null;
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "relative flex min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-forest transition-colors duration-200 hover:bg-khaki-soft",
        className,
      )}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <span key={addedTick} className={cn("grid size-7 place-items-center", addedTick && "cart-bounce")}>
        <BagIcon className="size-[22px]" />
      </span>
      <span className="hidden text-[11px] leading-none font-semibold text-ink-muted tabular-nums lg:block">{total ?? "Cart"}</span>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className="absolute -top-0.5 right-0.5 grid min-w-5 place-items-center rounded-full bg-mustard px-1 text-[11px] leading-5 font-bold text-forest-deep ring-2 ring-white"
        >
          {count}
        </motion.span>
      )}
    </button>
  );
}
