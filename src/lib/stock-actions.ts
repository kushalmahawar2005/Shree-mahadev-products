"use server";

import { z } from "zod";
import { addBackInStockRequest } from "@/lib/server/inventory";

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
