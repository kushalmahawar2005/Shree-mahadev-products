"use server";

import { z } from "zod";

import {
  getProductImagesMap,
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

async function withImages(cart: Cart): Promise<Cart> {
  if (!cart.lines.length) return cart;
  const map = await getProductImagesMap([...new Set(cart.lines.map((l) => l.product.handle))].sort());
  return {
    ...cart,
    lines: cart.lines.map((l) =>
      map[l.product.handle]?.length ? { ...l, product: { ...l.product, images: map[l.product.handle] } } : l,
    ),
  };
}

export async function getCartAction(): Promise<Cart | null> {
  const id = await readCartId();
  if (!id) return null;
  try {
    const cart = await getCart(id);
    return cart ? await withImages(cart) : null;
  } catch {
    return null;
  }
}

const Qty = (min: number) => z.number().int().min(min).max(99);
const VariantId = z.string().min(1).max(100).regex(/^[a-z0-9-]+--[a-z0-9.]+$/);
const validQty = (qty: unknown, min: number) => Qty(min).parse(qty);

async function save(cart: Cart) {
  await writeCartId(cart.id);
  await persistCart(cart);
  return withImages(cart);
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<Cart> {
  VariantId.parse(variantId);
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
  VariantId.parse(lineId);
  const qty = validQty(quantity, 0);
  const cartId = await ensureCartId();
  return save(qty === 0 ? await removeCartLine(cartId, lineId) : await updateCartLine(cartId, lineId, qty));
}

export async function removeCartLineAction(lineId: string): Promise<Cart> {
  VariantId.parse(lineId);
  const cartId = await ensureCartId();
  return save(await removeCartLine(cartId, lineId));
}
