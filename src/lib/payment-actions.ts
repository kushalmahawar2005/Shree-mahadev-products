"use server";

import { z } from "zod";
import { confirmOrderFromCashfree } from "@/lib/server/cashfree-process";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/**
 * Cashfree popup finished (paid, failed or closed). Asks Cashfree for the real status of this order's
 * open attempts; the browser's own result is never trusted.
 * It must NOT touch cookies: a cookie change in a server action re-renders the current route, and the pay
 * page starts a new payment attempt on every render. Once paid, the client goes to /api/cashfree/return,
 * which clears the cart and redirects to the order page.
 */
export async function confirmCashfreePaymentAction(rawToken: unknown): Promise<{ outcome: "paid" | "failed" | "pending" | "unpaid" | "none" | "error" }> {
  const token = z.string().regex(/^[a-f0-9]{32}$/).safeParse(rawToken);
  if (!token.success) return { outcome: "error" };
  const limit = await rateLimit("cashfree_confirm", await clientIp(), 30, 10);
  if (!limit.ok) return { outcome: "error" };
  return { outcome: await confirmOrderFromCashfree(token.data) };
}
