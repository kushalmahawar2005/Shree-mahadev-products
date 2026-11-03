import { NextResponse, type NextRequest } from "next/server";
import { getRecoverableItems } from "@/lib/server/carts";
import { restoreCart } from "@/lib/server/cart-cookies";

/** Link sent on WhatsApp/email for an abandoned cart: refills the cart and opens checkout. */
export async function GET(req: NextRequest, ctx: RouteContext<"/cart/recover/[token]">) {
  const { token } = await ctx.params;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const items = await getRecoverableItems(token).catch(() => null);
  if (!items) return NextResponse.redirect(`${base}/shop`, 303);
  await restoreCart(token, items);
  return NextResponse.redirect(`${base}/checkout`, 303);
}
