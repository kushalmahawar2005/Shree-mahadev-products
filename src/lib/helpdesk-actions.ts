"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safe } from "@/lib/action-result";
import { requireAdmin } from "@/lib/server/admin-auth";
import { RETURN_STATUSES, TICKET_STATUSES, notifyWaitlist, setReturnStatus, setTicketStatus } from "@/lib/server/helpdesk";

const id = z.number().int().positive();

export async function setReturnStatusAction(returnId: number, status: string, note?: string) {
  return safe(async () => {
    const admin = await requireAdmin();
    const v = z.object({ id, status: z.enum(RETURN_STATUSES), note: z.string().trim().max(300).optional() }).parse({ id: returnId, status, note });
    if (v.status === "rejected" && !v.note) throw new Error("Add a reason for the customer");
    const orderId = await setReturnStatus(v.id, v.status, admin.username, v.note);
    revalidatePath("/admin/helpdesk");
    revalidatePath("/admin/orders");
    revalidatePath(`/account/orders/${orderId}`);
  });
}

export async function setTicketStatusAction(ticketId: number, status: string) {
  return safe(async () => {
    await requireAdmin();
    const v = z.object({ id, status: z.enum(TICKET_STATUSES) }).parse({ id: ticketId, status });
    await setTicketStatus(v.id, v.status);
    revalidatePath("/admin/helpdesk");
  });
}

export async function notifyWaitlistAction(variantKey: string) {
  return safe(async () => {
    await requireAdmin();
    const n = await notifyWaitlist(z.string().min(1).max(100).parse(variantKey));
    revalidatePath("/admin/helpdesk");
    revalidatePath("/admin/inventory");
    return n;
  });
}
