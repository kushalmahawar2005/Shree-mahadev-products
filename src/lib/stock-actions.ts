"use server";

import { z } from "zod";
import { addBackInStockRequest } from "@/lib/server/inventory";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { getCustomerSession } from "@/lib/server/customer-auth";

const NotifyInput = z
  .object({
    variantKey: z.string().regex(/^[a-z0-9-]+--[a-z0-9.]+$/).max(100),
    phone: z
      .string()
      .transform((p) => p.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
      .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number")),
  })
  .strict();

/** "Notify me when back in stock". Saves the phone against the size. */
export async function notifyMeAction(input: { variantKey: string; phone: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const limit = await rateLimit("notify", await clientIp(), 8, 60);
  if (!limit.ok) return { ok: false, error: `Too many requests. Try again in ${limit.retryInMin} min.` };
  const parsed = NotifyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your number" };
  try {
    await addBackInStockRequest(parsed.data.variantKey, parsed.data.phone);
    return { ok: true };
  } catch (e) {
    console.error("notifyMe", e);
    return { ok: false, error: "Couldn't save that. Please try again." };
  }
}

/** Signed-in customer's mobile, to prefill the "Notify me" dialog. Empty when signed out. */
export async function notifyPrefillAction(): Promise<{ phone: string }> {
  try {
    const session = await getCustomerSession();
    const phone = session?.phone.replace(/\D/g, "").slice(-10) ?? "";
    return { phone: /^[6-9]\d{9}$/.test(phone) ? phone : "" };
  } catch {
    return { phone: "" };
  }
}
