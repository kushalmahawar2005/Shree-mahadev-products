"use server";

import type { RowDataPacket } from "mysql2/promise";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accountConfig } from "@/config/account";
import { requireCustomer } from "@/lib/server/customer-auth";
import { db } from "@/lib/server/db";
import { supportConfig } from "@/config/support";
import { createSupportTicket, queueSupportAlert, verifySupportPhoto } from "@/lib/server/support-tickets";
import { RETURN_REASONS } from "./returns";

const ReturnInput = z
  .object({
    orderId: z.number().int().positive(),
    items: z
      .array(z.object({ variantKey: z.string().min(1).max(80), qty: z.number().int().positive().max(99) }))
      .min(1, "Pick at least one item.")
      .max(30),
    reason: z.enum(RETURN_REASONS),
    note: z.string().trim().max(500).optional(),
    /** Optional photos of the box and label, already uploaded to Cloudinary by the browser. The unboxing
     *  video is sent on WhatsApp after this request. */
    media: z
      .array(z.object({ url: z.string().url().max(500), publicId: z.string().min(1).max(200) }).strict())
      .max(supportConfig.photos.max)
      .default([]),
  })
  .strict();

/**
 * Shopper asks to return delivered items. Checks ownership, the return window, eligible
 * categories and quantities on the server; the team reviews it in admin.
 */
export async function requestReturnAction(raw: unknown) {
  const customer = await requireCustomer();
  const parsed = ReturnInput.safeParse(raw);
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { orderId, items, reason, note, media } = parsed.data;

  const [[o]] = await db().query<RowDataPacket[]>(
    // Delivery date: courier's delivered_at, else when the order was marked delivered (admin / no shipment).
    `SELECT o.status, DATEDIFF(NOW(), COALESCE(s.delivered_at,
         (SELECT MAX(e.created_at) FROM order_events e WHERE e.order_id=o.id AND e.to_status='delivered'))) AS days
       FROM orders o LEFT JOIN shipments s ON s.id = (SELECT MAX(id) FROM shipments WHERE order_id=o.id)
      WHERE o.id=? AND o.customer_id=?`,
    [orderId, customer.id],
  );
  if (!o) return { ok: false as const, error: "Order not found." };
  if (String(o.status) !== "delivered")
    return { ok: false as const, error: "Returns open once the order is delivered." };
  if (o.days == null || Number(o.days) > accountConfig.returnWindowDays)
    return {
      ok: false as const,
      error: `The ${accountConfig.returnWindowDays}-day return window has closed. Please raise a request in Help & support.`,
    };

  const [lines] = await db().query<RowDataPacket[]>(
    `SELECT oi.variant_key, oi.quantity, p.category FROM order_items oi
       LEFT JOIN products p ON p.handle = oi.product_handle WHERE oi.order_id=?`,
    [orderId],
  );
  const byKey = new Map(lines.map((l) => [String(l.variant_key), l]));
  for (const i of items) {
    const line = byKey.get(i.variantKey);
    if (!line || i.qty > Number(line.quantity))
      return { ok: false as const, error: "One of the items isn't in this order." };
    if (!(accountConfig.returnEligibleCategories as readonly string[]).includes(String(line.category ?? "")))
      return { ok: false as const, error: "One of the items can't be returned." };
  }

  for (const m of media) {
    const err = await verifySupportPhoto(m);
    if (err) return { ok: false as const, error: err };
  }

  try {
    await db().query(
      "INSERT INTO order_returns (order_id, customer_id, items, reason, note) VALUES (?, ?, ?, ?, ?)",
      [orderId, customer.id, JSON.stringify(items), reason, note || null],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY")
      return { ok: false as const, error: "A return is already requested for this order." };
    throw e;
  }
  await db().query(
    "INSERT INTO order_events (order_id, from_status, to_status, actor, note) VALUES (?, 'delivered', 'return_requested', 'customer', ?)",
    [orderId, `Return requested: ${reason}`],
  );

  // The claim (and any photos) goes to the helpdesk as a ticket; the video follows on WhatsApp.
  const [[on]] = await db().query<RowDataPacket[]>("SELECT order_no FROM orders WHERE id=?", [orderId]);
  const issue = reason === "Expired on arrival" ? "expired" : "damaged";
  const message = [`Return request: ${reason}.`, note ?? ""].filter(Boolean).join(" ").slice(0, supportConfig.messageMax);
  const { id, ticketNo } = await createSupportTicket({
    customerId: customer.id,
    orderId,
    issue,
    message,
    utr: null,
    contactPref: "whatsapp",
    callbackSlot: null,
    photos: media,
  });
  await queueSupportAlert({
    ticketId: id,
    ticketNo,
    customer: { name: customer.name, phone: customer.phone },
    orderId,
    orderNo: on ? String(on.order_no) : null,
    issue,
    message,
    utr: null,
    contactPref: "whatsapp",
    callbackSlot: null,
    photos: media.map((m) => m.url),
  });
  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true as const, ticketNo };
}
