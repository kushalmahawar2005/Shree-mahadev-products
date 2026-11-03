"use server";

import {
  addToCart,
  createCart,
  getCart,
  removeCartLine,
  updateCartLine,
  type Cart,
} from "./index";
import { persistCart, readCartId, writeCartId } from "@/lib/server/cart-cookies";

async function ensureCartId() {
  const existing = await readCartId();
  if (existing) return existing;
  const cart = await createCart();
  await writeCartId(cart.id);
  return cart.id;
}

export async function getCartAction(): Promise<Cart | null> {
  const id = await readCartId();
  if (!id) return null;
  try {
    return (await getCart(id)) ?? null;
  } catch {
    return null;
  }
}

function validQty(qty: unknown, min: number) {
  const n = Number(qty);
  if (!Number.isInteger(n) || n < min || n > 99) throw new Error("Invalid quantity");
  return n;
}

async function save(cart: Cart) {
  await writeCartId(cart.id);
  await persistCart(cart);
  return cart;
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<Cart> {
  if (typeof variantId !== "string" || !variantId) throw new Error("Invalid variant");
  const qty = validQty(quantity, 1);
  let cartId = await ensureCartId();
  let cart: Cart;
  try {
    cart = await addToCart(cartId, variantId, qty);
  } catch {
    // Cart expired or invalid: start a fresh one.
    cartId = (await createCart()).id;
    cart = await addToCart(cartId, variantId, qty);
  }
  return save(cart);
}

export async function updateCartLineAction(lineId: string, quantity: number): Promise<Cart> {
  const qty = validQty(quantity, 0);
  const cartId = await ensureCartId();
  return save(qty === 0 ? await removeCartLine(cartId, lineId) : await updateCartLine(cartId, lineId, qty));
}

export async function removeCartLineAction(lineId: string): Promise<Cart> {
  const cartId = await ensureCartId();
  return save(await removeCartLine(cartId, lineId));
}
