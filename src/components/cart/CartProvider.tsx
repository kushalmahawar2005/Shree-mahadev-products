"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import {
  addToCartAction,
  getCartAction,
  removeCartLineAction,
  updateCartLineAction,
} from "@/lib/commerce/actions";
import type { Cart } from "@/lib/commerce/types";

type CartContextValue = {
  cart: Cart | null;
  isOpen: boolean;
  pending: boolean;
  error: string | null;
  /** increments on every successful add, used to bounce the cart icon */
  addedTick: number;
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
  const [error, setError] = useState<string | null>(null);
  const [addedTick, setAddedTick] = useState(0);
  const [pending, startTransition] = useTransition();

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
    (fn: () => Promise<Cart>, after?: () => void) =>
      new Promise<void>((resolve) => {
        startTransition(async () => {
          try {
            setError(null);
            setCart(await fn());
            after?.();
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
      open: () => setOpen(true),
      close: () => setOpen(false),
      add: (variantId, quantity = 1) =>
        run(
          () => addToCartAction(variantId, quantity),
          () => {
            setAddedTick((t) => t + 1);
            setOpen(true);
          },
        ),
      update: (lineId, quantity) => run(() => updateCartLineAction(lineId, quantity)),
      remove: (lineId) => run(() => removeCartLineAction(lineId)),
    }),
    [cart, isOpen, pending, error, addedTick, run],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
