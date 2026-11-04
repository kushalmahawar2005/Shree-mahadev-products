"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { requireAdmin } from "@/lib/server/admin-auth";
import { db } from "@/lib/server/db";
import { INQUIRY_STATUSES } from "@/lib/inquiry-types";
import { notifyOrder, queueInquiryAlert } from "@/lib/server/mail";
import { createOrder, type OrderItemInput } from "@/lib/server/orders";
import { OutOfStockError } from "@/lib/server/inventory";
import { INDIAN_STATES } from "@/lib/checkout";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

const phone = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(
    z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number."),
  );
const email = z
  .string()
  .trim()
  .max(160)
  .refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email address.",
  );

const bulkInquirySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    business: z.string().trim().min(2).max(160),
    city: z.string().trim().min(2).max(80),
    phone,
    email,
    product: z.string().trim().min(2).max(160),
    quantity: z.string().trim().min(1).max(60),
    message: z.string().trim().max(1000),
    website: z.string().max(200),
  })
  .strict();

export async function submitBulkInquiryAction(raw: unknown) {
  const limit = await rateLimit("inquiry", await clientIp(), 5, 60);
  if (!limit.ok)
    return {
      ok: false,
      error: `Too many requests. Please try again in ${limit.retryInMin} min.`,
    };
  const parsed = bulkInquirySchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Please check the form and try again.",
    };
  const data = parsed.data;
  if (data.website.trim()) return { ok: true, silent: true };

  try {
    const [insert] = await db().execute<ResultSetHeader>(
      `INSERT INTO inquiries (kind, name, business, city, phone, email, product, quantity, message)
       VALUES ('bulk', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.business,
        data.city,
        data.phone,
        data.email || null,
        data.product,
        data.quantity,
        data.message || null,
      ],
    );
    await queueInquiryAlert(Number(insert.insertId), data);
    return { ok: true };
  } catch (error) {
    console.error("Bulk inquiry submission failed", error);
    return {
      ok: false,
      error:
        "We couldn't save this inquiry. WhatsApp is still available below.",
    };
  }
}

const idSchema = z.number().int().positive();
const updateStatusSchema = z
  .object({ id: idSchema, status: z.enum(INQUIRY_STATUSES) })
  .strict();
const updateDetailsSchema = z
  .object({
    id: idSchema,
    assignee: z.string().trim().max(60),
    followUpAt: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
    quoteAmount: z.number().int().min(0).max(100_000_000).nullable(),
  })
  .strict();
const addNoteSchema = z
  .object({ id: idSchema, body: z.string().trim().min(1).max(2000) })
  .strict();
const manualOrderSchema = z
  .object({
    inquiryId: idSchema,
    name: z.string().trim().min(2).max(120),
    phone,
    email,
    line1: z.string().trim().min(5).max(255),
    line2: z.string().trim().max(255),
    city: z.string().trim().min(2).max(80),
    state: z
      .string()
      .refine((value) => (INDIAN_STATES as readonly string[]).includes(value)),
    pincode: z
      .string()
      .trim()
      .regex(/^[1-9]\d{5}$/),
    method: z.enum(["cod", "offline"]),
    shipping: z.number().int().min(0).max(100_000),
    items: z
      .array(
        z
          .object({
            variantKey: z.string().min(1).max(100),
            quantity: z.number().int().min(1).max(100),
            unitPrice: z.number().int().min(1).max(500_000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

async function logMutation(
  username: string,
  action: string,
  id: number,
  meta: object,
) {
  await db().execute(
    "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, ?, ?, ?)",
    [username, action, `inquiry:${id}`, JSON.stringify(meta)],
  );
}

export async function updateInquiryStatusAction(raw: unknown) {
  const admin = await requireAdmin();
  const parsed = updateStatusSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid status update." };
  const { id, status } = parsed.data;
  try {
    const [[found]] = await db().query<RowDataPacket[]>(
      "SELECT id FROM inquiries WHERE id=? AND kind='bulk'",
      [id],
    );
    if (!found) return { ok: false, error: "Inquiry not found." };
    await db().execute(
      "UPDATE inquiries SET status=? WHERE id=? AND kind='bulk'",
      [status, id],
    );
    await logMutation(admin.username, "inquiry.status_changed", id, { status });
    revalidatePath("/admin/inquiries");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("Inquiry status update failed", error);
    return { ok: false, error: "Could not update inquiry status." };
  }
}

export async function updateInquiryDetailsAction(raw: unknown) {
  const admin = await requireAdmin();
  const parsed = updateDetailsSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: "Check assignee, follow-up date and quote amount.",
    };
  const { id, assignee, followUpAt, quoteAmount } = parsed.data;
  try {
    const [[found]] = await db().query<RowDataPacket[]>(
      "SELECT id FROM inquiries WHERE id=? AND kind='bulk'",
      [id],
    );
    if (!found) return { ok: false, error: "Inquiry not found." };
    await db().execute(
      "UPDATE inquiries SET assignee=?, follow_up_at=?, quote_amount=? WHERE id=? AND kind='bulk'",
      [assignee || null, followUpAt || null, quoteAmount, id],
    );
    await logMutation(admin.username, "inquiry.details_updated", id, {
      assignee: assignee || null,
      followUpAt: followUpAt || null,
      quoteAmount,
    });
    revalidatePath("/admin/inquiries");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("Inquiry details update failed", error);
    return { ok: false, error: "Could not save inquiry details." };
  }
}

export async function addInquiryNoteAction(raw: unknown) {
  const admin = await requireAdmin();
  const parsed = addNoteSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "Add a note up to 2,000 characters." };
  const { id, body } = parsed.data;
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [found] = await conn.query(
      "SELECT id FROM inquiries WHERE id=? AND kind='bulk' FOR UPDATE",
      [id],
    );
    if (!Array.isArray(found) || !found.length) {
      await conn.rollback();
      return { ok: false, error: "Inquiry not found." };
    }
    await conn.execute(
      "INSERT INTO inquiry_notes (inquiry_id, author, body) VALUES (?, ?, ?)",
      [id, admin.username, body],
    );
    await conn.execute(
      "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'inquiry.note_added', ?, ?)",
      [
        admin.username,
        `inquiry:${id}`,
        JSON.stringify({ noteLength: body.length }),
      ],
    );
    await conn.commit();
    revalidatePath("/admin/inquiries");
    return { ok: true };
  } catch (error) {
    await conn.rollback();
    console.error("Inquiry note save failed", error);
    return { ok: false, error: "Could not save note." };
  } finally {
    conn.release();
  }
}

export async function createManualInquiryOrderAction(raw: unknown) {
  const admin = await requireAdmin();
  const parsed = manualOrderSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the order details.",
    };
  const data = parsed.data;
  const keys = data.items.map((item) => item.variantKey);
  if (new Set(keys).size !== keys.length)
    return {
      ok: false,
      error:
        "Each product size can be added once. Update its quantity instead.",
    };

  try {
    const [[lead]] = await db().query<RowDataPacket[]>(
      "SELECT id, status FROM inquiries WHERE id=? AND kind='bulk'",
      [data.inquiryId],
    );
    if (!lead || lead.status !== "won")
      return {
        ok: false,
        error: "Manual orders can only be created for won inquiries.",
      };
    const [variants] = await db().query<RowDataPacket[]>(
      `SELECT v.variant_key, v.title AS variant_title, v.sku, v.price, v.compare_at_price, v.available, v.stock_qty,
         p.handle AS product_handle, p.title AS product_title
       FROM product_variants v JOIN products p ON p.id=v.product_id
       WHERE v.variant_key IN (?) AND p.status='active'`,
      [keys],
    );
    if (variants.length !== keys.length)
      return {
        ok: false,
        error: "One or more selected product sizes are no longer available.",
      };

    const items: OrderItemInput[] = data.items.map((item) => {
      const variant = variants.find(
        (row) => row.variant_key === item.variantKey,
      );
      if (
        !variant ||
        !variant.available ||
        (variant.stock_qty !== null &&
          Number(variant.stock_qty) < item.quantity)
      ) {
        throw new OutOfStockError([
          {
            title: String(variant?.product_title ?? "Selected product"),
            available: Number(variant?.stock_qty ?? 0),
          },
        ]);
      }
      return {
        variantKey: String(variant.variant_key),
        productHandle: String(variant.product_handle),
        productTitle: String(variant.product_title),
        variantTitle: String(variant.variant_title),
        sku: variant.sku ? String(variant.sku) : undefined,
        unitPrice: Number(variant.price),
        compareAtPrice:
          variant.compare_at_price === null
            ? undefined
            : Number(variant.compare_at_price),
        quantity: item.quantity,
      };
    });
    // Price entered by the admin is the order snapshot price; catalog price is
    // only used as the initial value in the form.
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const priceOverrides = Object.fromEntries(
      data.items.map((item) => [item.variantKey, item.unitPrice]),
    );
    if (subtotal > 100_000_000)
      return {
        ok: false,
        error: "Order total is too high. Reduce the quantities and try again.",
      };

    const created = await createOrder({
      source: "admin",
      method: data.method,
      priceOverrides,
      address: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        line1: data.line1,
        line2: data.line2 || undefined,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
      },
      items,
      subtotal,
      shipping: data.shipping,
      codFee: 0,
      courierId: null,
      courierName: null,
    });
    try {
      await db().execute(
        "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'inquiry.order_created', ?, ?)",
        [
          admin.username,
          `inquiry:${data.inquiryId}`,
          JSON.stringify({
            orderId: created.id,
            orderNo: created.orderNo,
            method: data.method,
            subtotal,
          }),
        ],
      );
      await db().execute(
        "INSERT INTO inquiry_notes (inquiry_id, author, body) VALUES (?, ?, ?)",
        [
          data.inquiryId,
          admin.username,
          `Manual order ${created.orderNo} created.`,
        ],
      );
    } catch (error) {
      console.error(
        "Manual order created but inquiry audit note failed",
        created.orderNo,
        error,
      );
    }
    await notifyOrder(
      created.id,
      data.method === "offline" ? "payment_received" : "order_placed",
    );
    revalidatePath("/admin/inquiries");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true, orderId: created.id, orderNo: created.orderNo };
  } catch (error) {
    if (error instanceof OutOfStockError)
      return { ok: false, error: error.message };
    console.error("Manual inquiry order failed", error);
    return {
      ok: false,
      error:
        "Could not create the order. Check the address and stock, then try again.",
    };
  }
}
