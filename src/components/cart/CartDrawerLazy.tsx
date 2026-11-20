"use client";

import dynamic from "next/dynamic";
import type { Product } from "@/lib/commerce/types";
import { useIdleReady } from "@/hooks/use-idle-ready";
import { useCart } from "./CartProvider";

// The drawer (coupon check, upsells, number animations) is only seen after "Add to cart" or the cart
// icon, so its code is split out of the first load and fetched when the browser is idle or on first open.
const CartDrawer = dynamic(() => import("./CartDrawer").then((m) => m.CartDrawer), { ssr: false });

export function CartDrawerLazy(props: { upsells: Product[]; catalog?: Product[] }) {
  const { isOpen } = useCart();
  const idle = useIdleReady();
  return idle || isOpen ? <CartDrawer {...props} /> : null;
}
