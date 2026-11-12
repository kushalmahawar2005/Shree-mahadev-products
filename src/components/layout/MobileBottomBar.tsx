"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { BagIcon, SearchIcon, ShopIcon, UserIcon } from "./icons";

/**
 * Sticky bottom bar on mobile: Shop, Search, Cart, Account. (WhatsApp stays reachable from the footer and product pages.)
 * Hidden on checkout: that page has its own sticky "Pay" bar in the same spot, and leaving
 * mid-checkout through Shop/Search is not something to invite.
 */
export function MobileBottomBar() {
  const { cart, open } = useCart();
  const pathname = usePathname();
  const count = cart?.totalQuantity ?? 0;
  if (pathname?.startsWith("/checkout")) return null;
  const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-forest-text";

  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Link href="/shop" className={item}>
        <ShopIcon className="size-5" />
        Shop
      </Link>
      <Link href="/search" className={item}>
        <SearchIcon className="size-5" />
        Search
      </Link>
      <button type="button" onClick={open} className={item} aria-label={`Cart, ${count} items`}>
        <span className="relative">
          <BagIcon className="size-5" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full bg-forest px-1 text-[10px] text-white">
              {count}
            </span>
          )}
        </span>
        Cart
      </button>
      <Link href="/account" className={item}>
        <UserIcon className="size-5" />
        Account
      </Link>
    </nav>
  );
}
