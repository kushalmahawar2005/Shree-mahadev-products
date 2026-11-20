import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { addToCart, createCart, type Cart } from "@/lib/commerce";
import { syncCart } from "./carts";
import { readAttributionCookie, syncAttributionToCart } from "./attribution";

export const CART_COOKIE = "smp_cart";
/** Stable id of this shopper's cart row in MySQL (abandoned-cart tracking + recovery link). */
export const CART_DB_COOKIE = "smp_cid";

export const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function readCartId() {
  return (await cookies()).get(CART_COOKIE)?.value;
}

export async function writeCartId(id: string) {
  (await cookies()).set(CART_COOKIE, id, cookieOpts);
}

export async function getCartDbToken(): Promise<string | undefined> {
  const v = (await cookies()).get(CART_DB_COOKIE)?.value;
  return v && /^[a-f0-9]{32}$/.test(v) ? v : undefined;
}

/** Mirror the cart into MySQL. Never throws: the cart must work even if the DB is down. */
export async function persistCart(cart: Cart) {
  let token = await getCartDbToken();
  if (!token) {
    token = randomBytes(16).toString("hex");
    (await cookies()).set(CART_DB_COOKIE, token, cookieOpts);
  }
  try {
    await syncCart(token, cart);
    await syncAttributionToCart(await readAttributionCookie());
  } catch (e) {
    console.error("syncCart failed", e);
  }
}

/** Recovery link: restore a saved cart into this browser. */
export async function restoreCart(token: string, items: { variantKey: string; quantity: number }[]) {
  let cart = await createCart();
  for (const i of items) {
    try {
      cart = await addToCart(cart.id, i.variantKey, Math.min(i.quantity, 99));
    } catch {
      // variant no longer sold: skip it
    }
  }
  await writeCartId(cart.id);
  (await cookies()).set(CART_DB_COOKIE, token, cookieOpts);
  await persistCart(cart);
}

export async function clearCartCookies() {
  const jar = await cookies();
  jar.delete(CART_COOKIE);
  jar.delete(CART_DB_COOKIE);
}

/**
 * True when this browser's cart already became a paid order. Online payments can finish without
 * passing the route that clears the cart cookies (webhook won the race, popup closed, a reload), so
 * every cart read checks this and drops the old cart instead of showing bought items again.
 * Cookies can only be deleted in a server action / route handler; in a page render we just report it.
 */
export async function dropConvertedCart(): Promise<boolean> {
  const token = await getCartDbToken();
  if (!token) return false;
  try {
    const [[row]] = await db().query<RowDataPacket[]>("SELECT status FROM carts WHERE token = ?", [token]);
    if (row?.status !== "converted") return false;
  } catch {
    return false; // DB down: keep the cart working
  }
  try {
    await clearCartCookies();
  } catch {
    // read-only cookies (page render): the next cart action clears them
  }
  return true;
}
