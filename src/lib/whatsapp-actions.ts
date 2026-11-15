"use server";

import { safe } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, logAdminActivity } from "@/lib/server/admin-auth";
import {
  addWhatsAppOptout,
  listWhatsAppMessages,
  listWhatsAppTemplates,
  processWhatsAppOutbox,
  queueOrderWhatsApp,
  setWhatsAppTemplate,
} from "@/lib/server/whatsapp";
import type { OrderTemplate } from "@/lib/server/whatsapp";

const templateSchema = z.enum([
  "order_placed", "cod_confirmation", "shipped", "out_for_delivery", "delivery_failed", "delivered", "cancelled", "payment_pending",
  "abandoned_cart_1h", "abandoned_cart_24h", "back_in_stock",
]);

export async function toggleWhatsAppTemplateAction(raw: unknown) {
  return safe(async () => {
    const admin = await requireRole("owner", "manager");
    const parsed = z.object({ template: templateSchema, enabled: z.boolean() }).strict().parse(raw);
    await setWhatsAppTemplate(parsed.template, parsed.enabled);
    await logAdminActivity(admin.username, "whatsapp.template_updated", parsed.template, { enabled: parsed.enabled });
    revalidatePath("/admin/messages");
  });
}

export async function testWhatsAppAction(raw: unknown) {
  return safe(async () => {
    const admin = await requireRole("owner", "manager");
    const parsed = z.object({ orderId: z.number().int().positive(), template: templateSchema }).strict().parse(raw);
    await queueOrderWhatsApp(parsed.orderId, parsed.template as OrderTemplate);
    const result = await processWhatsAppOutbox(1);
    await logAdminActivity(admin.username, "whatsapp.test_sent", String(parsed.orderId), { template: parsed.template, result });
    return result;
  });
}

export async function processWhatsAppAction() {
  return safe(async () => {
    const admin = await requireRole("owner", "manager");
    const result = await processWhatsAppOutbox();
    await logAdminActivity(admin.username, "whatsapp.outbox_processed", undefined, result);
    revalidatePath("/admin/messages");
    return result;
  });
}

export async function optOutWhatsAppAction(raw: unknown) {
  return safe(async () => {
    const admin = await requireRole("owner", "manager");
    const parsed = z.object({ phone: z.string().regex(/^[6-9]\d{9}$/) }).strict().parse(raw);
    await addWhatsAppOptout(parsed.phone);
    await logAdminActivity(admin.username, "whatsapp.opted_out", parsed.phone);
    revalidatePath("/admin/messages");
  });
}

export async function getWhatsAppAdminData() {
  await requireRole("owner", "manager");
  return { templates: await listWhatsAppTemplates(), messages: await listWhatsAppMessages() };
}
