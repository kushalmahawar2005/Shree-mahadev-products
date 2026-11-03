"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { markReminderSent } from "@/lib/server/carts";

export async function markReminderSentAction(cartId: number) {
  await requireAdmin();
  if (!Number.isInteger(cartId) || cartId <= 0) throw new Error("Invalid cart");
  await markReminderSent(cartId);
  revalidatePath("/admin/abandoned-carts");
}
