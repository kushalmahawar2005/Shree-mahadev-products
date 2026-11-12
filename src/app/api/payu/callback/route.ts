import { NextResponse, type NextRequest } from "next/server";
import { CART_COOKIE, CART_DB_COOKIE } from "@/lib/server/cart-cookies";
import { confirmOrderFromPayu, handlePayuResult } from "@/lib/server/payu-process";

/** PayU browser return (surl + furl). The S2S webhook (/api/payu/webhook) handles the same result if the tab closes. */
export async function POST(req: NextRequest) {
  // In dev, come back to the server that started the payment (localhost), not the live domain.
  const base = (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL) || req.nextUrl.origin;
  const p: Record<string, string> = {};
  (await req.formData()).forEach((v, k) => {
    if (typeof v === "string") p[k] = v;
  });
  let { outcome, orderToken } = await handlePayuResult(p, "callback");
  // No usable form body: fall back to the order token we put on the return URL and ask PayU directly.
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!orderToken && /^[a-f0-9]{32}$/.test(t)) {
    const r = await confirmOrderFromPayu(t);
    if (r !== "none") {
      orderToken = t;
      if (r === "paid") outcome = "paid";
    }
  }
  if (!orderToken) return NextResponse.redirect(`${base}/checkout?payment=unknown`, 303);
  const back = NextResponse.redirect(`${base}/order?t=${orderToken}`, 303);
  if (outcome === "paid" || outcome === "duplicate") {
    back.cookies.delete(CART_COOKIE);
    back.cookies.delete(CART_DB_COOKIE);
  }
  return back;
}
