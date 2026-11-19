import { NextResponse, type NextRequest } from "next/server";
import { CART_COOKIE, CART_DB_COOKIE } from "@/lib/server/cart-cookies";
import { confirmOrderFromCashfree } from "@/lib/server/cashfree-process";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/**
 * Cashfree return_url. Used when the popup can't open (in-app browsers) and Cashfree sends the shopper
 * to its own page and back here. The order token on the URL is all we trust; Cashfree's API decides.
 */
export async function GET(req: NextRequest) {
  const base = (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL) || req.nextUrl.origin;
  const limit = await rateLimit("cashfree_return", await clientIp(), 30, 10);
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!limit.ok || !/^[a-f0-9]{32}$/.test(t)) return NextResponse.redirect(`${base}/checkout?payment=unknown`, 303);
  const outcome = await confirmOrderFromCashfree(t);
  const back = NextResponse.redirect(`${base}/order?t=${t}`, 303);
  if (outcome === "paid") {
    back.cookies.delete(CART_COOKIE);
    back.cookies.delete(CART_DB_COOKIE);
  }
  return back;
}
