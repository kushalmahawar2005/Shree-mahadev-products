"use server";

import { z } from "zod";
import { lookupTrackingByCredentials } from "@/lib/server/tracking";

const Lookup = z.object({
  orderNo: z.string().trim().min(1).max(32),
  phone: z.string().trim().min(1).max(24),
}).strict();

export async function lookupTrackingAction(input: { orderNo: string; phone: string }) {
  const parsed = Lookup.safeParse(input);
  if (!parsed.success) return { tracking: null, error: "Enter your order number and phone number." };
  return lookupTrackingByCredentials(parsed.data.orderNo, parsed.data.phone);
}
