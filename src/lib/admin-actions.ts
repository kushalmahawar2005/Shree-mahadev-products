"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { markReminderSent } from "@/lib/server/carts";
import { listOrderEmails, processOutbox, queueOrderEmail, type OutboxRow } from "@/lib/server/mail";
import { z as zz } from "zod";
import {
  bookShipment,
  cancelOrderShipment,
  labelForOrder,
  requestPickup,
  quoteForOrder,
  refreshTracking,
  type CourierQuote,
  type Shipment,
} from "@/lib/server/shipments";
import { getOrderById, setOrderStatus, type OrderStatus } from "@/lib/server/orders";

export async function markReminderSentAction(cartId: number) {
  await requireAdmin();
  if (!Number.isInteger(cartId) || cartId <= 0) throw new Error("Invalid cart");
  await markReminderSent(cartId);
  revalidatePath("/admin/abandoned-carts");
}

// ───────────── Shipping (NimbusPost) ─────────────


type Dims = { length: number; breadth: number; height: number };
const okDims = (d: Dims) => [d?.length, d?.breadth, d?.height].every((n) => Number.isFinite(n) && n > 0 && n <= 200);
const okWeight = (w: number) => Number.isInteger(w) && w >= 50 && w <= 50_000;

export async function quoteCouriersAction(orderId: number, weightGrams: number, dims: Dims): Promise<CourierQuote[]> {
  await requireAdmin();
  if (!Number.isInteger(orderId) || !okWeight(weightGrams) || !okDims(dims)) throw new Error("Check weight and box size");
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  return quoteForOrder(order, weightGrams, dims);
}

export async function bookShipmentAction(orderId: number, courierId: string, weightGrams: number, dims: Dims): Promise<Shipment[]> {
  await requireAdmin();
  if (!Number.isInteger(orderId) || !okWeight(weightGrams) || !okDims(dims) || !/^[A-Za-z0-9_-]{1,40}$/.test(courierId)) {
    throw new Error("Check courier, weight and box size");
  }
  const out = await bookShipment(orderId, { courierId, weightGrams, dims });
  revalidatePath("/admin/orders");
  return out;
}

export async function cancelShipmentAction(orderId: number): Promise<Shipment[]> {
  await requireAdmin();
  const out = await cancelOrderShipment(orderId);
  revalidatePath("/admin/orders");
  return out;
}

export async function refreshTrackingAction(orderId: number): Promise<Shipment[]> {
  await requireAdmin();
  return refreshTracking(orderId);
}

const MANUAL: OrderStatus[] = ["confirmed", "delivered", "cancelled", "refunded"];

export async function setOrderStatusAction(orderId: number, status: OrderStatus, note: string) {
  await requireAdmin();
  if (!Number.isInteger(orderId) || !MANUAL.includes(status)) throw new Error("Invalid status");
  await setOrderStatus(orderId, status, "admin", String(note ?? "").slice(0, 300) || undefined);
  revalidatePath("/admin/orders");
}

export async function labelUrlAction(orderId: number): Promise<string> {
  await requireAdmin();
  return labelForOrder(orderId);
}

export async function requestPickupAction(orderId: number): Promise<Shipment[]> {
  await requireAdmin();
  return requestPickup(orderId);
}

// ───────────── Order emails ─────────────

const EmailKindSchema = zz.enum(["order_placed", "payment_received", "shipped", "delivered", "cancelled", "refund", "store_new_order"]);

export async function resendOrderEmailAction(orderId: number, kind: string): Promise<OutboxRow[]> {
  await requireAdmin();
  const id = zz.number().int().positive().parse(orderId);
  await queueOrderEmail(id, EmailKindSchema.parse(kind), { resend: true });
  await processOutbox();
  return listOrderEmails(id);
}
