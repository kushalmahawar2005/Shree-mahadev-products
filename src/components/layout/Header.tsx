"use client";

import { AccountMenu } from "./AccountMenu";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Flame, Search, Truck } from "lucide-react";
import { formatMoney } from "@/lib/utils/money";
import { StickyHeader, useHeaderCompact } from "@/components/motion/StickyHeader";
import { getLenis } from "@/components/motion/scroll-lock";
import { useCart } from "@/components/cart/CartProvider";
import type { MenuGroup, NavItem } from "@/data/site";
import { cn } from "@/lib/utils/cn";
import { BagIcon, ChevronDown, MenuIcon } from "./icons";
import type { MenuData, MenuProduct } from "./MegaMenu";
import { SearchBox } from "./SearchBox";
import dynamic from "next/dynamic";

// cmdk (~100 KB) loads only when the search overlay is first opened, not on every page view.
const SearchCommand = dynamic(() => import("./SearchCommand").then((m) => m.SearchCommand), { ssr: false });
// Menus are only needed once the shopper hovers / taps, so their code is split out of the first load
// and fetched when the browser is idle (or on first use).
const MegaMenu = dynamic(() => import("./MegaMenu").then((m) => m.MegaMenu), { ssr: false });
const MobileNav = dynamic(() => import("./MobileNav").then((m) => m.MobileNav), { ssr: false });
import { useIdleReady } from "@/hooks/use-idle-ready";

const LOGO = "https://res.cloudinary.com/bmqxsylj/image/upload/f_auto,q_auto:good,c_limit,w_160/v1793735979/swadeshi-mahadev/static/logo.png";
const OPEN_DELAY = 100; // hover intent before a mega menu opens
const CLOSE_GRACE = 120; // time to move the pointer from the nav into the panel

/**
 * Site header.
 * Full (top of page): announcement strip · search | centred logo | track, account, cart · text nav.
 * Compact (scrolled past 80px, desktop): ONE row (h-16): small logo · nav · search icon, account, cart,
 * on a blurred cream bar. The strip and the main row collapse with a 250ms grid-rows animation; the
 * header is fixed with a full-height spacer, so the page never jumps.
 * Phones: one row (menu · logo · search + cart) under the strip.
 */
export function Header({
  menus,
  nav,
  recommended,
  announcement,
  allProducts,
}: {
  menus: MenuData;
  nav: NavItem[];
  collections?: { handle: string; title: string }[];
  recommended: MenuProduct[];
  allProducts: MenuProduct[];
  /** Server-rendered announcement bar (reads store settings). */
  announcement?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpenState] = useState(false);
  // Once opened, keep the overlay mounted so closing still animates.
  const [searchUsed, setSearchUsed] = useState(false);
  const setSearchOpen = (v: boolean) => {
    if (v) setSearchUsed(true);
    setSearchOpenState(v);
  };
  const pathname = usePathname();
  const idle = useIdleReady();

  // Close menus on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  return (
    <>
      <StickyHeader>
        <HeaderBar
          announcement={announcement}
          nav={nav}
          menus={menus}
          recommended={recommended}
          allProducts={allProducts}
          onMenu={() => setMenuOpen(true)}
          onSearch={() => setSearchOpen(true)}
          pathname={pathname}
        />
      </StickyHeader>

      {(searchOpen || searchUsed) && <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} products={allProducts} recommended={recommended} />}
      {(idle || menuOpen) && <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} menus={menus} nav={nav} />}
    </>
  );
}

function HeaderBar({
  announcement,
  nav,
  menus,
  recommended,
  allProducts,
  onMenu,
  onSearch,
  pathname,
}: {
  announcement?: React.ReactNode;
  nav: NavItem[];
  menus: MenuData;
  recommended: MenuProduct[];
  allProducts: MenuProduct[];
  onMenu: () => void;
  onSearch: () => void;
  pathname: string;
}) {
  const compact = useHeaderCompact();
  const idle = useIdleReady();
  const [mega, setMega] = useState<MenuGroup | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navRef = useRef<HTMLElement>(null);

  // Close the mega menu on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMega(null);
  }

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  const openSoon = (g: MenuGroup) => {
    clearTimers();
    openTimer.current = setTimeout(() => setMega(g), mega ? 0 : OPEN_DELAY);
  };
  const keepOpen = () => clearTimeout(closeTimer.current);
  const closeSoon = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMega(null), CLOSE_GRACE);
  };

  // Escape closes the panel and returns focus to its nav item.
  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const g = mega;
      setMega(null);
      navRef.current?.querySelector<HTMLElement>(`[data-menu="${g}"]`)?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mega]);
  useEffect(() => () => clearTimers(), []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const goHomeTop = () => {
    const lenis = getLenis();
    // Already on home: glide up; from another page the route change lands at the top.
    const onHome = window.location.pathname === "/";
    if (lenis) lenis.scrollTo(0, onHome ? { duration: 0.8 } : { immediate: true });
    else window.scrollTo({ top: 0, behavior: onHome ? "smooth" : "instant" });
  };
  // ONE indicator: the underline follows the hovered item, else the open menu's item, else the current page.
  const marked = hovered ?? nav.find((n) => n.menu && n.menu === mega)?.href ?? nav.find((n) => isActive(n.href))?.href ?? null;

  return (
    <div
      className={cn(
        "relative w-full border-b text-forest-text transition-[background-color,border-color,box-shadow] duration-[250ms]",
        compact
          ? "border-line/70 bg-page/85 shadow-[0_6px_18px_-12px_rgba(7,47,27,0.25)] backdrop-blur-md"
          : "border-line bg-white",
      )}
    >
      {/* Announcement strip: collapses on scroll */}
      <Collapse open={!compact}>{announcement}</Collapse>

      {/* Main row: always on phones; on desktop it collapses into the compact nav row */}
      <Collapse open={!compact} desktopOnly>
        <div className="mx-auto grid max-w-[1360px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2 sm:px-5 xl:px-8 xl:py-2.5">
          <div className="flex items-center">
            <button type="button" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-forest/5 xl:hidden" aria-label="Open menu" onClick={onMenu}>
              <MenuIcon />
            </button>
            <div className="hidden w-full max-w-[300px] xl:block">
              <SearchBox recommended={recommended} all={allProducts} />
            </div>
          </div>

          <Link href="/" onNavigate={goHomeTop} className="justify-self-center" aria-label="Swadeshi Mahadev Products, home">
            <motion.span
              className="block"
              initial={{ scale: 0.7, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              whileHover={{ rotate: 12, scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              {/* The logo rolls like a wheel left and right, then rests (logo-roll in globals.css). */}
              <Image src={LOGO} alt="" width={80} height={80} priority unoptimized className="logo-roll size-12 xl:size-[68px]" />
            </motion.span>
          </Link>

          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <button type="button" onClick={onSearch} className="grid size-11 place-items-center rounded-xl hover:bg-forest/5 xl:hidden" aria-label="Search">
              <Search className="size-[22px]" strokeWidth={1.6} />
            </button>
            <HeaderAction href="/track-order" label="Track" className="hidden xl:flex">
              <Truck className="size-[22px]" strokeWidth={1.6} aria-hidden />
            </HeaderAction>
            <div className="hidden xl:block"><AccountMenu /></div>
            <CartButton />
          </div>
        </div>
      </Collapse>

      {/* Nav row (desktop). Compact: small logo · nav · search, account, cart in one h-16 row. */}
      <nav ref={navRef} aria-label="Main" className="hidden xl:block" onMouseEnter={keepOpen} onMouseLeave={closeSoon}>
        <div className={cn("mx-auto flex max-w-[1360px] items-center px-8 transition-[height] duration-[250ms]", compact ? "h-16" : "h-12")}>
          <div className={cn("shrink-0 items-center", compact ? "flex w-14" : "hidden")} aria-hidden={!compact}>
            <Link href="/" onNavigate={goHomeTop} aria-label="Swadeshi Mahadev Products, home" tabIndex={compact ? 0 : -1}>
              <Image src={LOGO} alt="" width={40} height={40} unoptimized className="size-10" />
            </Link>
          </div>

          <ul className={cn("flex min-w-0 flex-1 items-center justify-center gap-1", !compact && "border-t border-line")} onMouseLeave={() => setHovered(null)}>
            {nav.map((item) => {
              const active = isActive(item.href);
              const open = !!item.menu && mega === item.menu;
              return (
                <li
                  key={item.href}
                  className="relative shrink-0"
                  onMouseEnter={() => {
                    setHovered(item.href);
                    if (item.menu) openSoon(item.menu);
                    else closeSoon();
                  }}
                >
                  <Link
                    href={item.href}
                    data-menu={item.menu}
                    aria-expanded={item.menu ? open : undefined}
                    aria-haspopup={item.menu ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={(e) => {
                      // Touch (no hover): first tap opens the menu, second tap follows the link.
                      if (item.menu && !open && window.matchMedia("(hover: none)").matches) {
                        e.preventDefault();
                        clearTimers();
                        setMega(item.menu);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!item.menu) return;
                      if ((e.key === "Enter" && !open) || e.key === "ArrowDown") {
                        e.preventDefault();
                        clearTimers();
                        setMega(item.menu);
                        requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-mega-panel] a")?.focus());
                      }
                    }}
                    className="relative inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[14px] 2xl:px-4 2xl:text-[16px] font-bold tracking-[-0.005em] text-black transition-colors duration-200 hover:text-forest"
                  >
                    {item.icon === "bestseller" && <Flame className="size-4 text-mustard" strokeWidth={2} aria-hidden />}
                    {item.menu && (
                      // Category icon (client's line art, public/icons/nav-*.png) as a mask so it takes the brand green.
                      <span
                        aria-hidden
                        className={cn("inline-block shrink-0 bg-forest", item.menu === "oils" ? "size-[30px] 2xl:size-[32px]" : "size-[24px] 2xl:size-[26px]")}
                        style={{
                          maskImage: `url(/icons/nav-${item.menu === "oils" ? "oil" : item.menu === "honey" ? "honey" : "sweetener"}.png)`,
                          WebkitMaskImage: `url(/icons/nav-${item.menu === "oils" ? "oil" : item.menu === "honey" ? "honey" : "sweetener"}.png)`,
                          maskSize: "contain",
                          WebkitMaskSize: "contain",
                          maskRepeat: "no-repeat",
                          WebkitMaskRepeat: "no-repeat",
                          maskPosition: "center",
                          WebkitMaskPosition: "center",
                        }}
                      />
                    )}
                    {item.label}
                    {item.menu && <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />}
                    {marked === item.href && (
                      <motion.span
                        layoutId="nav-underline"
                        aria-hidden
                        className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-mustard"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className={cn("shrink-0 items-center justify-end gap-1", compact ? "flex w-32" : "hidden")} aria-hidden={!compact}>
            <button type="button" onClick={onSearch} tabIndex={compact ? 0 : -1} className="grid size-10 place-items-center rounded-xl text-forest hover:bg-forest/5" aria-label="Search">
              <Search className="size-[22px]" strokeWidth={1.6} />
            </button>
            <AccountMenu compact tabIndex={compact ? 0 : -1} />
            <CartButton compact tabIndex={compact ? 0 : -1} />
          </div>
        </div>
      </nav>

      {/* Full-width layer ignores the pointer; only the visible panel keeps the menu open (MegaMenu),
          so moving off the panel to either side closes it straight away. */}
      <div className="pointer-events-none absolute inset-x-0 top-full z-30">
        {(idle || mega) && <MegaMenu open={mega} data={menus} onNavigate={() => setMega(null)} onMouseEnter={keepOpen} onMouseLeave={closeSoon} />}
      </div>
    </div>
  );
}

/** Height-collapse with a grid-rows transition (250ms). `desktopOnly`: phones always keep it open. */
function Collapse({ open, desktopOnly, children }: { open: boolean; desktopOnly?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        // minmax(0,1fr) column: without it the row grows to its widest child (the announcement marquee).
        "grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,opacity] duration-[250ms] ease-out",
        open ? "grid-rows-[1fr] opacity-100" : desktopOnly ? "grid-rows-[1fr] opacity-100 xl:grid-rows-[0fr] xl:opacity-0" : "grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={!open && !desktopOnly ? true : undefined}
    >
      {/* Clip only while collapsed: when open, dropdowns (search suggestions) must spill out below. */}
      <div className={cn("min-h-0 min-w-0", open ? "overflow-visible" : desktopOnly ? "overflow-visible xl:overflow-hidden" : "overflow-hidden")}>{children}</div>
    </div>
  );
}

/** Icon with a small caption under it (desktop). Same size, label and hover for every action. */
function HeaderAction({ href, label, className, children }: { href: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    // /account redirects signed-out visitors to /login in the proxy; prefetching that redirect 404s.
    <Link href={href} prefetch={href === "/account" ? false : undefined} aria-label={label} className={cn("group/act min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-forest transition-colors hover:bg-forest/5", className)}>
      <span className="grid size-7 place-items-center transition-transform duration-200 group-hover/act:-translate-y-0.5">{children}</span>
      <span className="text-[11px] leading-none font-bold text-forest-text">{label}</span>
    </Link>
  );
}

/** Cart: icon + "Cart" label + count badge. The total shows as a tooltip (and in the drawer). */
export function CartButton({ className, compact = false, tabIndex }: { className?: string; compact?: boolean; tabIndex?: number }) {
  const { cart, open, addedTick } = useCart();
  const count = cart?.totalQuantity ?? 0;
  const total = count ? formatMoney(cart?.subtotal.amount ?? 0) : null;
  return (
    <button
      type="button"
      onClick={open}
      tabIndex={tabIndex}
      title={total ? `Cart total ${total}` : undefined}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 rounded-xl text-forest transition-colors duration-200 hover:bg-forest/5",
        compact ? "size-10" : "min-w-14 px-2 py-1.5",
        className,
      )}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}${total ? `, ${total}` : ""}`}
    >
      <span key={`bounce-${addedTick}`} data-cart-target="" className={cn("grid size-7 place-items-center", addedTick && "cart-bounce")}>
        <BagIcon className="size-[22px]" />
      </span>
      {!compact && <span className="hidden text-[11px] leading-none font-bold text-forest-text xl:block">Cart</span>}
      {count > 0 && (
        <motion.span
          key={`count-${count}`}
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
