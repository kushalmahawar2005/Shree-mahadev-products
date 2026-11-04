"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
          className="relative w-full border-b border-line bg-white text-forest-text"
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
              <Image
                src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png"
                alt=""
                width={80}
                height={80}
                priority
                unoptimized
                className="size-14 transition-transform duration-300 group-data-[compact]/header:scale-[0.85] lg:size-[68px]"
              />
            </Link>

            <div className="flex items-center justify-end gap-1 sm:gap-2 lg:gap-3">
              <Link
                href="/search"
                className="grid size-11 place-items-center rounded-full hover:bg-khaki-soft lg:hidden"
                aria-label="Search"
              >
                <SearchIcon />
              </Link>
              {/* TODO: customer accounts (OTP login) are planned; link goes to order tracking for now */}
              <Link
                href="/track-order"
                className="hidden size-11 place-items-center rounded-full text-forest transition-colors duration-200 hover:bg-khaki-soft sm:grid"
                aria-label="My account"
              >
                <UserIcon className="size-6" />
              </Link>
              <CartButton />
            </div>
          </div>

          {/* Text nav (desktop), separated by a thin rule like Two Brothers */}
          <nav aria-label="Main" className="hidden lg:block">
            <div className="mx-auto max-w-[1360px] px-8">
              <ul className="flex items-center justify-center gap-1 border-t border-line">
                {nav.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li
                      key={item.href}
                      onMouseEnter={() =>
                        item.menu ? openMega(item.menu) : closeMega()
                      }
                    >
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
                          "relative inline-flex min-h-11 items-center gap-1.5 px-4 text-[15px] font-semibold tracking-wide text-forest-text transition-colors duration-200 hover:text-forest",
                          item.icon === "bestseller" &&
                            "text-sale hover:text-sale",
                        )}
                      >
                        {item.icon === "bestseller" && <PercentIcon />}
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
                            "absolute inset-x-4 bottom-0 h-0.5 origin-left rounded-full bg-mustard transition-transform duration-300",
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

          <div onMouseEnter={keepMega}>
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

function PercentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M19 5L5 19" strokeLinecap="round" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </svg>
  );
}

export function CartButton({ className }: { className?: string }) {
  const { cart, open, addedTick } = useCart();
  const count = cart?.totalQuantity ?? 0;
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "relative grid size-11 place-items-center rounded-full text-forest transition-colors duration-200 hover:bg-khaki-soft",
        className,
      )}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <span key={addedTick} className={addedTick ? "cart-bounce" : undefined}>
        <BagIcon />
      </span>
      <span className="absolute top-0.5 right-0 grid min-w-5 place-items-center rounded-full bg-forest px-1 text-[11px] leading-5 font-bold text-white">
        {count}
      </span>
    </button>
  );
}
