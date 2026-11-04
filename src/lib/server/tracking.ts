import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { clientIp, rateLimit } from "./rate-limit";

export type TrackingSummary = {
  orderNo: string;
  status: string;
  createdAt: string;
  maskedAddress: string;
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
  expectedDelivery: string | null;
  events: { status: string; label: string; at: string; location: string | null }[];
};

const labels: Record<string, string> = {
  pending_payment: "Waiting for payment",
  payment_failed: "Payment failed",
  paid: "Payment received",
  cod_pending: "Order placed · cash on delivery",
  confirmed: "Order confirmed",
  packed: "Order packed",
  shipped: "Handed to courier",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rto: "Returning to sender",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
  booked: "Shipment booked",
  picked: "Picked up",
};

const cleanStatus = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_");
const labelStatus = (value: string) => labels[cleanStatus(value)] ?? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const maskPincode = (value: string) => value.length > 2 ? `${"•".repeat(value.length - 2)}${value.slice(-2)}` : "••••••";

async function rateLookup() {
  const limit = await rateLimit("track", await clientIp(), 20, 10);
  return limit.ok ? null : `Too many lookup attempts. Try again in ${limit.retryInMin} min.`;
}

async function loadTracking(orderId: number): Promise<TrackingSummary | null> {
  const [[order]] = await db().execute<RowDataPacket[]>(
    `SELECT id, order_no, status, created_at, city, state, pincode
     FROM orders WHERE id=? LIMIT 1`, [orderId],
  );
  if (!order) return null;
  const [[shipment]] = await db().execute<RowDataPacket[]>(
    `SELECT id, courier, awb, tracking_url, status, estimated_delivery
     FROM shipments WHERE order_id=? AND status <> 'cancelled' ORDER BY id DESC LIMIT 1`, [orderId],
  );
  const [orderRows] = await db().execute<RowDataPacket[]>(
    "SELECT to_status AS status, created_at AS at FROM order_events WHERE order_id=? ORDER BY id ASC LIMIT 100", [orderId],
  );
  const [shipmentRows] = shipment
    ? await db().execute<RowDataPacket[]>(
      "SELECT status, location, event_at AS at FROM shipment_events WHERE shipment_id=? ORDER BY event_at ASC LIMIT 100", [shipment.id],
    )
    : [[] as RowDataPacket[]];
  const events = [
    ...orderRows.map((event) => ({ status: String(event.status), at: String(event.at), location: null as string | null })),
    ...shipmentRows.map((event) => ({ status: String(event.status), at: String(event.at), location: event.location ? String(event.location) : null })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const pincode = String(order.pincode ?? "");
  return {
    orderNo: String(order.order_no),
    status: String(order.status),
    createdAt: String(order.created_at),
    maskedAddress: ["••••••", order.city, order.state, maskPincode(pincode)].filter(Boolean).join(", "),
    courier: shipment?.courier ? String(shipment.courier) : null,
    awb: shipment?.awb ? String(shipment.awb) : null,
    trackingUrl: shipment?.tracking_url ? String(shipment.tracking_url) : null,
    expectedDelivery: shipment?.estimated_delivery ? String(shipment.estimated_delivery).slice(0, 10) : null,
    events: events.map((event) => ({ ...event, label: labelStatus(event.status) })),
  };
}

export async function lookupTrackingByCredentials(orderNo: string, phone: string) {
  const blocked = await rateLookup();
  if (blocked) return { tracking: null, error: blocked };
  const normalizedOrderNo = orderNo.trim().toUpperCase();
  const normalizedPhone = phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^SMP[A-Z0-9-]{4,28}$/.test(normalizedOrderNo) || !/^[6-9]\d{9}$/.test(normalizedPhone)) {
    return { tracking: null, error: "Enter a valid order number and 10-digit phone number." };
  }
  const [[order]] = await db().execute<RowDataPacket[]>(
    "SELECT id FROM orders WHERE order_no=? AND phone=? LIMIT 1", [normalizedOrderNo, normalizedPhone],
  );
  if (!order) return { tracking: null, error: "We couldn't find an order with those details. Check them and try again." };
  return { tracking: await loadTracking(Number(order.id)), error: null };
}

export async function lookupTrackingByToken(token: string) {
  const blocked = await rateLookup();
  if (blocked) return { tracking: null, error: blocked };
  if (!/^[a-f0-9]{32}$/.test(token)) return { tracking: null, error: "This tracking link is invalid or has expired." };
  const [[order]] = await db().execute<RowDataPacket[]>("SELECT id FROM orders WHERE token=? LIMIT 1", [token]);
  if (!order) return { tracking: null, error: "This tracking link is invalid or has expired." };
  return { tracking: await loadTracking(Number(order.id)), error: null };
}

