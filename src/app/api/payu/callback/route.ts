import { NextResponse, type NextRequest } from "next/server";
import { CART_COOKIE, CART_DB_COOKIE } from "@/lib/server/cart-cookies";
import { getPayment, logWebhook, markPaid, markPaymentFailed } from "@/lib/server/orders";
import { notifyOrder } from "@/lib/server/mail";
import { verifyPaymentWithPayu, verifyPayuResponse } from "@/lib/server/payu";

/**
 * PayU posts here (surl and furl) after the shopper pays or cancels.
 * We trust nothing until: hash matches, amount matches the attempt, and PayU's
 * verify_payment API confirms success server-to-server.
 */
export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const form = await req.formData();
  const p: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") p[k] = v;
  });

  // Keep the raw callback (minus the hash) for disputes.
  const safe = { ...p };
  delete safe.hash;
  await logWebhook("payu", p.txnid ?? null, safe, p.status).catch((e) => console.error("logWebhook", e));

  const pay = p.txnid ? await getPayment(p.txnid) : null;
  if (!pay) return NextResponse.redirect(`${base}/checkout?payment=unknown`, 303);
  const back = NextResponse.redirect(`${base}/order?t=${pay.orderToken}`, 303);
  if (pay.status === "success") return back; // already handled (double POST / refresh)

  if (!verifyPayuResponse(p) || p.udf1 !== pay.orderToken) {
    console.error("PayU hash mismatch", { txnid: p.txnid });
    await markPaymentFailed(pay.id, pay.orderId, "Hash verification failed");
    return back;
  }

  if (p.status === "success" && Number(p.amount) === pay.amount) {
    const check = await verifyPaymentWithPayu(p.txnid);
    if (check?.status === "success" && check.amount === pay.amount) {
      await markPaid(pay.id, pay.orderId, { mihpayid: p.mihpayid, mode: p.mode });
      await notifyOrder(pay.orderId, "payment_received");
      back.cookies.delete(CART_COOKIE);
      back.cookies.delete(CART_DB_COOKIE);
      return back;
    }
    // Hash valid but PayU's API didn't confirm yet: keep pending for a manual check.
    console.error("PayU verify_payment did not confirm", { txnid: p.txnid, check });
    await markPaymentFailed(pay.id, pay.orderId, "Awaiting PayU confirmation", "pending");
    return back;
  }

  await markPaymentFailed(pay.id, pay.orderId, p.error_Message || p.field9 || p.status || "Payment failed");
  return back;
}
