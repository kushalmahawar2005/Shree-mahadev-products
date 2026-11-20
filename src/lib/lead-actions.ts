"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireRole } from "@/lib/server/admin-auth";
import { getCartDbToken } from "@/lib/server/cart-cookies";
import { captureLead, LEAD_POPUP_TAG, markLeadContacted, saveLeadPopupConfig } from "@/lib/server/leads";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { LeadPopupSchema, LeadSchema, type LeadPopupConfig } from "@/lib/lead-popup";

type LeadResult = { ok: true; code: string; percent: number } | { ok: false; error: string };

/** Storefront popup submit: save the lead and reveal the coupon code. */
export async function submitLeadAction(input: { name: string; phone: string; page: string }): Promise<LeadResult> {
  const parsed = LeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };
  const limit = await rateLimit("lead", await clientIp(), 6, 60);
  if (!limit.ok) return { ok: false, error: `Too many tries. Please try again in ${limit.retryInMin} min.` };
  try {
    const coupon = await captureLead({ ...parsed.data, cartToken: await getCartDbToken() });
    if (!coupon) return { ok: false, error: "This offer has ended. Thank you for visiting!" };
    revalidatePath("/admin/abandoned-carts");
    return { ok: true, code: coupon.code, percent: coupon.percent };
  } catch (e) {
    console.error("submitLeadAction", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function saveLeadPopupAction(input: LeadPopupConfig) {
  await requireRole("owner", "manager");
  const c = LeadPopupSchema.parse(input);
  if (c.enabled && !c.couponCode) throw new Error("Pick a coupon before turning the popup on");
  await saveLeadPopupConfig(c);
  updateTag(LEAD_POPUP_TAG);
  revalidatePath("/admin/abandoned-carts");
}

export async function markLeadContactedAction(id: number) {
  await requireAdmin();
  const leadId = z.number().int().positive().parse(id);
  await markLeadContacted(leadId);
  revalidatePath("/admin/abandoned-carts");
}
