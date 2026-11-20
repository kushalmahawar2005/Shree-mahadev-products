"use server";

import { safe, type ActionResult } from "@/lib/action-result";
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, requireRole } from "@/lib/server/admin-auth";
import { markReminderSent } from "@/lib/server/carts";
import { listOrderEmails, processOutbox, queueOrderEmail, type OutboxRow } from "@/lib/server/mail";
import { z as zz } from "zod";
import {
  bookShipment,
  cancelOrderShipment,
  labelForOrder,
  requestPickup,
  applyNdrAction,
  createDailyManifest,
  listNdrCases,
  quoteForOrder,
  refreshTracking,
  type CourierQuote,
  type Shipment,
} from "@/lib/server/shipments";
import { clearOrderAttention, getOrderById, refundableFor, setOrderStatus, type OrderStatus } from "@/lib/server/orders";
import { BULK_STATUS, bulkBookShipments, bulkCancelShipments, bulkSetStatus, type BulkResult, type BulkStatus } from "@/lib/server/bulk-orders";

export async function markReminderSentAction(cartId: number) {
  return safe(async () => {
    await requireAdmin();
    if (!Number.isInteger(cartId) || cartId <= 0) throw new Error("Invalid cart");
    await markReminderSent(cartId);
    revalidatePath("/admin/abandoned-carts");
  });
}

// ───────────── Shipping (NimbusPost) ─────────────


type Dims = { length: number; breadth: number; height: number };
const okDims = (d: Dims) => [d?.length, d?.breadth, d?.height].every((n) => Number.isFinite(n) && n > 0 && n <= 200);
const okWeight = (w: number) => Number.isInteger(w) && w >= 50 && w <= 50_000;

export async function quoteCouriersAction(orderId: number, weightGrams: number, dims: Dims): Promise<ActionResult<CourierQuote[]>> {
  return safe(async () => {
    await requireAdmin();
    if (!Number.isInteger(orderId) || !okWeight(weightGrams) || !okDims(dims)) throw new Error("Check weight and box size");
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");
    return quoteForOrder(order, weightGrams, dims);
  });
}

export async function bookShipmentAction(orderId: number, courierId: string, weightGrams: number, dims: Dims): Promise<ActionResult<Shipment[]>> {
  return safe(async () => {
    await requireAdmin();
    if (!Number.isInteger(orderId) || !okWeight(weightGrams) || !okDims(dims) || !/^[A-Za-z0-9_-]{1,40}$/.test(courierId)) {
      throw new Error("Check courier, weight and box size");
    }
    const out = await bookShipment(orderId, { courierId, weightGrams, dims });
    revalidatePath("/admin/orders");
    return out;
  });
}

// ───────────── Bulk (orders list) ─────────────

const bulkIds = zz.array(zz.number().int().positive()).min(1).max(50);

/** Book shipments for many orders at once (cheapest courier, weight from the catalog). */
export async function bulkBookShipmentsAction(ids: number[]): Promise<ActionResult<BulkResult[]>> {
  return safe(async () => {
    await requireAdmin();
    const out = await bulkBookShipments([...new Set(bulkIds.parse(ids))]);
    revalidatePath("/admin/orders");
    return out;
  });
}

export async function bulkCancelShipmentsAction(ids: number[]): Promise<ActionResult<BulkResult[]>> {
  return safe(async () => {
    await requireAdmin();
    const out = await bulkCancelShipments([...new Set(bulkIds.parse(ids))]);
    revalidatePath("/admin/orders");
    return out;
  });
}

export async function bulkStatusAction(ids: number[], status: BulkStatus): Promise<ActionResult<BulkResult[]>> {
  return safe(async () => {
    await requireAdmin();
    if (!(status in BULK_STATUS)) throw new Error("Invalid status");
    const out = await bulkSetStatus([...new Set(bulkIds.parse(ids))], status);
    revalidatePath("/admin/orders");
    return out;
  });
}

export async function cancelShipmentAction(orderId: number): Promise<ActionResult<Shipment[]>> {
  return safe(async () => {
    await requireAdmin();
    const out = await cancelOrderShipment(orderId);
    revalidatePath("/admin/orders");
    return out;
  });
}

export async function refreshTrackingAction(orderId: number): Promise<ActionResult<Shipment[]>> {
  return safe(async () => {
    await requireAdmin();
    return refreshTracking(orderId);
  });
}

const MANUAL: OrderStatus[] = ["confirmed", "delivered", "cancelled", "refunded"];

export async function setOrderStatusAction(orderId: number, status: OrderStatus, note: string) {
  return safe(async () => {
    await requireAdmin();
    if (!Number.isInteger(orderId) || !MANUAL.includes(status)) throw new Error("Invalid status");
    const text = String(note ?? "").trim().slice(0, 300);
    // "Refunded" set by hand moves no money: PayU money must go through the Refund panel, and an
    // offline refund (COD / bank transfer) must say how it was paid back.
    // Cancelling a paid online order by hand would restock and tell the customer "cancelled" with no
    // money back. Full refund from the Refund panel does it properly (refund + cancel stock + message).
    if (status === "cancelled") {
      const left = (await refundableFor(orderId))?.left ?? 0;
      if (left > 0) throw new Error(`This order is paid online (₹${left}). Use the Refund panel: a full refund also closes the order and puts the stock back.`);
    }
    if (status === "refunded") {
      const left = (await refundableFor(orderId))?.left ?? 0;
      if (left > 0) throw new Error(`₹${left} is still refundable on PayU. Use the Refund panel so the money actually goes back.`);
      if (text.length < 5) throw new Error("Add a note: how was the money refunded (UPI / bank ref)?");
    }
    await setOrderStatus(orderId, status, "admin", text || undefined);
    revalidatePath("/admin/orders");
  });
}

export async function labelUrlAction(orderId: number): Promise<ActionResult<string>> {
  return safe(async () => {
    await requireAdmin();
    return labelForOrder(orderId);
  });
}

export async function requestPickupAction(orderId: number): Promise<ActionResult<Shipment[]>> {
  return safe(async () => {
    await requireAdmin();
    return requestPickup(orderId);
  });
}

export async function createDailyManifestAction(date?: string) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const parsed = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00+05:30`) : new Date();
    return createDailyManifest(parsed);
  });
}

export async function listNdrAction() {
  return safe(async () => {
    await requireAdmin();
    return listNdrCases();
  });
}

export async function ndrAction(awb: string, action: "reattempt" | "change_address_phone" | "rto", details?: { address?: string; phone?: string }) {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (action === "change_address_phone" && (!details?.address || !/^[6-9]\d{9}$/.test(details.phone ?? ""))) {
      throw new Error("Address and valid phone are required");
    }
    await applyNdrAction(awb, action, details);
  });
}

// ───────────── Payments (PayU) ─────────────

/** "Check with PayU": verify the order's latest open payment attempt right now. */
export async function verifyPaymentAction(orderId: number) {
  return safe(async () => {
    await requireAdmin();
    const id = zz.number().int().positive().parse(orderId);
    const { verifyOrderPayment } = await import("@/lib/server/payu-process");
    const outcome = await verifyOrderPayment(id);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return outcome;
  });
}

// ───────────── Order emails ─────────────

const EmailKindSchema = zz.enum(["order_placed", "payment_received", "shipped", "delivered", "cancelled", "refund", "store_new_order"]);

export async function resendOrderEmailAction(orderId: number, kind: string): Promise<ActionResult<OutboxRow[]>> {
  return safe(async () => {
    await requireAdmin();
    const id = zz.number().int().positive().parse(orderId);
    await queueOrderEmail(id, EmailKindSchema.parse(kind), { resend: true });
    await processOutbox();
    return listOrderEmails(id);
  });
}

// ───────────── Refunds ─────────────
/** Step 1 of a refund: email a 6-digit approval code to the owner's inbox (REFUND_OTP_EMAIL). */
export async function sendRefundOtpAction(orderId: number, amount: number) {
  return safe(async () => {
    const admin = await requireAdmin();
    if (admin.role !== "owner") throw new Error("Only the owner can issue refunds");
    const v = zz.object({ orderId: zz.number().int().positive(), amount: zz.number().int().positive().max(1_000_000) }).parse({ orderId, amount });
    const { rateLimit } = await import("@/lib/server/rate-limit");
    const limit = await rateLimit("refund_otp", admin.username, 5, 15);
    if (!limit.ok) throw new Error(`Too many codes sent. Try again in ${limit.retryInMin} min.`);
    const { sendRefundOtp } = await import("@/lib/server/refund-otp");
    return sendRefundOtp(v.orderId, v.amount, admin.username);
  });
}

/** Step 2: the emailed code must match this order + amount before the gateway is asked to refund. */
export async function refundOrderAction(orderId: number, amount: number, reason: string, otp: string) {
  return safe(async () => {
    const admin = await requireAdmin();
    if (admin.role !== "owner") throw new Error("Only the owner can issue refunds");
    const { refundOrder } = await import("@/lib/server/refunds");
    const v = zz
      .object({ orderId: zz.number().int().positive(), amount: zz.number().int().positive().max(1_000_000), reason: zz.string().trim().max(200), otp: zz.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") })
      .parse({ orderId, amount, reason, otp });
    const { consumeRefundOtp } = await import("@/lib/server/refund-otp");
    await consumeRefundOtp(v.orderId, v.amount, admin.username, v.otp);
    const out = await refundOrder(v.orderId, v.amount, v.reason, admin.username);
    revalidatePath("/admin/orders");
    return out;
  });
}

// ───────────── Store settings ─────────────
export async function saveStoreSettingsAction(input: unknown) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const { StoreSettingsSchema } = await import("@/lib/store-settings");
    const parsed = StoreSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new Error(`${i.path.join(" › ")}: ${i.message}`);
    }
    const { saveStoreSettings, SETTINGS_TAG } = await import("@/lib/server/store-settings");
    await saveStoreSettings(parsed.data);
    updateTag(SETTINGS_TAG);
  });
}

/** Admin handled the "needs attention" flag on an order (extra payment, stuck refund/shipment, cancel request). */
export async function clearOrderAttentionAction(orderId: number, note: string) {
  return safe(async () => {
    await requireAdmin();
    if (!Number.isInteger(orderId)) throw new Error("Invalid order");
    await clearOrderAttention(orderId, String(note ?? "").trim().slice(0, 200) || undefined);
    revalidatePath("/admin/orders");
  });
}
