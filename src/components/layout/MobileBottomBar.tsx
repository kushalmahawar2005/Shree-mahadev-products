"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { whatsappLink } from "@/data/site";
import { BagIcon, SearchIcon, ShopIcon, WhatsAppIcon } from "./icons";

/** Sticky bottom bar on mobile: Shop, Search, Cart, WhatsApp. */
export function MobileBottomBar() {
  const { cart, open } = useCart();
  const count = cart?.totalQuantity ?? 0;
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
      <a
        href={whatsappLink("Hi, I'd like to place an order.")}
        target="_blank"
        rel="noopener noreferrer"
        className={item}
      >
        <WhatsAppIcon className="size-5" />
        WhatsApp
      </a>
    </nav>
  );
}
