import { NextResponse, type NextRequest } from "next/server";
import { CART_COOKIE, CART_DB_COOKIE } from "@/lib/server/cart-cookies";
import { handlePayuResult } from "@/lib/server/payu-process";

/** PayU browser return (surl + furl). The S2S webhook (/api/payu/webhook) handles the same result if the tab closes. */
export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const p: Record<string, string> = {};
  (await req.formData()).forEach((v, k) => {
    if (typeof v === "string") p[k] = v;
  });
  const { outcome, orderToken } = await handlePayuResult(p, "callback");
  if (!orderToken) return NextResponse.redirect(`${base}/checkout?payment=unknown`, 303);
  const back = NextResponse.redirect(`${base}/order?t=${orderToken}`, 303);
  if (outcome === "paid" || outcome === "duplicate") {
    back.cookies.delete(CART_COOKIE);
    back.cookies.delete(CART_DB_COOKIE);
  }
  return back;
}
