"use client";

import { useLoadingSignal } from "@/components/motion/LoadingBar";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addToCartAction,
  getCartAction,
  removeCartLineAction,
  updateCartLineAction,
} from "@/lib/commerce/actions";
import type { Cart } from "@/lib/commerce/types";
import { Toaster, toast } from "sonner";
import { AddedToast } from "./AddedToast";

type CartContextValue = {
  cart: Cart | null;
  isOpen: boolean;
  pending: boolean;
  error: string | null;
  /** increments on every successful add, used to bounce the cart icon */
  addedTick: number;
  /** The variant added most recently (+ a tick), so the drawer can show it on top and flash it. */
  lastAdded: { variantId: string; tick: number } | null;
  open: () => void;
  close: () => void;
  add: (variantId: string, quantity?: number) => Promise<void>;
  update: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isOpen, setOpen] = useState(false);
  // Read inside async callbacks (the add finishes after a render), so a ref, not the state value.
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = isOpen;
  }, [isOpen]);
  // Item count before the latest add (a ref so the async add callback sees the real value).
  const countRef = useRef(0);
  useEffect(() => {
    countRef.current = cart?.totalQuantity ?? 0;
  }, [cart]);
  const [error, setError] = useState<string | null>(null);
  const [addedTick, setAddedTick] = useState(0);
  const [lastAdded, setLastAdded] = useState<{ variantId: string; tick: number } | null>(null);
  const [pending, startTransition] = useTransition();
  useLoadingSignal(pending);

  useEffect(() => {
    let alive = true;
    getCartAction()
      .then((c) => alive && setCart(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(
    (fn: () => Promise<Cart>, after?: (next: Cart) => void) =>
      new Promise<void>((resolve) => {
        startTransition(async () => {
          try {
            setError(null);
            const next = await fn();
            setCart(next);
            after?.(next);
          } catch {
            setError("Something went wrong. Please try again.");
          } finally {
            resolve();
          }
        });
      }),
    [],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isOpen,
      pending,
      error,
      addedTick,
      lastAdded,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add: (variantId, quantity = 1) => {
        const wasEmpty = countRef.current === 0;
        return run(
          () => addToCartAction(variantId, quantity),
          (next) => {
            setAddedTick((t) => t + 1);
            setLastAdded((p) => ({ variantId, tick: (p?.tick ?? 0) + 1 }));
            // First product into an empty cart: open the drawer once (after the fly-to-cart lands) so
            // the shopper sees the cart. Every later add: a small toast instead, so shopping isn't
            // interrupted; "View cart" opens the drawer. Nothing while the drawer is already open.
            if (wasEmpty && !openRef.current) {
              setTimeout(() => {
                setOpen(true);
                burst();
              }, 450);
              return;
            }
            // Added from inside the open drawer (upsells, undo): a small burst from the drawer.
            if (openRef.current) burst(0.5);
            const line = next.lines.find((l) => l.variant.id === variantId);
            if (line && !openRef.current)
              setTimeout(
                () => !openRef.current && toast.custom((id) => <AddedToast line={line} count={next.totalQuantity} onView={() => (toast.dismiss(id), setOpen(true))} />, { id: "cart-added", duration: 3500 }),
                450,
              );
          },
        );
      },
      update: (lineId, quantity) => run(() => updateCartLineAction(lineId, quantity)),
      remove: (lineId) => run(() => removeCartLineAction(lineId)),
    }),
    [cart, isOpen, pending, error, addedTick, lastAdded, run],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* Bottom-centre; on phones it sits just above the bottom bar (56px + safe area). */}
      <Toaster position="bottom-center" offset={{ bottom: 24 }} mobileOffset={{ bottom: 76, left: 12, right: 12 }} gap={8} />
    </CartContext.Provider>
  );
}

/** Brand-colour confetti from the cart drawer side (skipped for reduced motion). */
export function burst(scale = 1) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#0c3c24", "#b49024", "#f6efe2", "#f08a24"];
  const x = window.innerWidth < 640 ? 0.5 : 0.84;
  // Loaded only when it fires, so the library isn't in every page's JS.
  void import("canvas-confetti").then(({ default: confetti }) => confetti({ particleCount: Math.round(60 * scale), spread: 70, startVelocity: 34, origin: { x, y: 0.25 }, colors, zIndex: 9999, scalar: 0.9 }));
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
