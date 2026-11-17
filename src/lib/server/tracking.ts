import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { clientIp, rateLimit } from "./rate-limit";
import { dedupeScans, scanLine } from "@/lib/tracking-text";

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
  /** Where the parcel is, Amazon-style: 0 ordered · 1 shipped · 2 out for delivery · 3 delivered; null for cancelled / unpaid / RTO. */
  stage: 0 | 1 | 2 | 3 | null;
  /** When each stage was reached (first time). */
  milestones: { ordered: string; shipped: string | null; outForDelivery: string | null; delivered: string | null };
  /** Courier scans only, oldest first, as readable lines ("Left Jaipur hub"). */
  scans: { line: string; at: string }[];
  /** Order history for the shopper: forward-only, each step once (no internal back-and-forth). */
  history: { label: string; at: string }[];
};

/** Customer-facing order steps in their natural order; anything going "backwards" is internal and hidden. */
const HISTORY_ORDER = ["pending_payment", "paid", "cod_pending", "confirmed", "packed", "shipped", "delivered"];
const HISTORY_LABEL: Record<string, string> = {
  pending_payment: "Order placed",
  paid: "Payment received",
  cod_pending: "Order placed · cash on delivery",
  confirmed: "Order confirmed",
  packed: "Packed and ready to ship",
  shipped: "Handed to the courier",
  delivered: "Delivered",
  cancelled: "Order cancelled",
  refunded: "Refund issued",
  partially_refunded: "Part refund issued",
  rto: "Returning to us",
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
      "SELECT status, location, message, event_at AS at FROM shipment_events WHERE shipment_id=? ORDER BY event_at ASC LIMIT 100", [shipment.id],
    )
    : [[] as RowDataPacket[]];
  // Courier scans read like the courier's own tracking ("Left Jaipur hub", "Reached Ajmer"): the place is
  // already in the line, so `location` stays empty for them. Repeated identical scans show once.
  const events = dedupeScans([
    ...orderRows.map((event) => ({ status: String(event.status), at: String(event.at), location: null as string | null, line: labelStatus(String(event.status)) })),
    ...shipmentRows.map((event) => ({
      status: String(event.status),
      at: String(event.at),
      location: null as string | null,
      line: scanLine(String(event.status), event.message ? String(event.message) : null, event.location ? String(event.location) : null),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at)));
  const pincode = String(order.pincode ?? "");

  // Courier scans (newest wording first-class) and the customer-facing milestones.
  const scans = dedupeScans(
    shipmentRows.map((e) => ({
      status: String(e.status).toLowerCase(),
      at: String(e.at),
      line: scanLine(String(e.status), e.message ? String(e.message) : null, e.location ? String(e.location) : null),
    })),
  );
  const firstScan = (re: RegExp) => scans.find((e) => re.test(`${e.status} ${e.line}`.toLowerCase()))?.at ?? null;
  const firstOrder = (st: string) => orderRows.find((e) => String(e.status) === st)?.at;
  const status = String(order.status);
  const delivered = firstOrder("delivered") ? String(firstOrder("delivered")) : firstScan(/^delivered|\bdelivered$/);
  const outForDelivery = firstScan(/out for delivery|out_for_delivery/);
  const shipped = firstScan(/picked|left|reached|transit|out for delivery/) ?? (firstOrder("shipped") ? String(firstOrder("shipped")) : null);
  const stage: TrackingSummary["stage"] =
    ["cancelled", "rto", "pending_payment", "payment_failed", "refunded"].includes(status) ? null
      : status === "delivered" || delivered ? 3
        : outForDelivery && status !== "delivered" ? 2
          : status === "shipped" || shipped ? 1
            : 0;

  // Forward-only history: keep each step once, and drop a step that appears after a later one
  // (e.g. "paid" again when a shipment was cancelled and re-booked).
  const history: { label: string; at: string }[] = [];
  let furthest = -1;
  const seen = new Set<string>();
  for (const e of orderRows) {
    const st = String(e.status);
    if (seen.has(st)) continue;
    const rank = HISTORY_ORDER.indexOf(st);
    if (rank !== -1 && rank <= furthest) continue;
    if (st === "payment_failed") continue;
    seen.add(st);
    if (rank !== -1) furthest = rank;
    history.push({ label: HISTORY_LABEL[st] ?? labelStatus(st), at: String(e.at) });
  }

  return {
    orderNo: String(order.order_no),
    status: String(order.status),
    createdAt: String(order.created_at),
    maskedAddress: ["••••••", order.city, order.state, maskPincode(pincode)].filter(Boolean).join(", "),
    courier: shipment?.courier ? String(shipment.courier) : null,
    awb: shipment?.awb ? String(shipment.awb) : null,
    trackingUrl: shipment?.tracking_url ? String(shipment.tracking_url) : null,
    expectedDelivery: shipment?.estimated_delivery ? String(shipment.estimated_delivery).slice(0, 10) : null,
    events: events.map(({ line, ...event }) => ({ ...event, label: line })),
    stage,
    milestones: { ordered: String(order.created_at), shipped, outForDelivery, delivered },
    scans: scans.map(({ line, at }) => ({ line, at })),
    history,
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


export type MyTrackableOrder = { orderNo: string; token: string; status: string; label: string; createdAt: string; total: number; items: number; firstItem: string | null };

/** Signed-in shopper's recent orders for the one-tap picker on /track-order (newest first). */
export async function listMyTrackableOrders(customerId: number, limit = 8): Promise<MyTrackableOrder[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT o.order_no, o.token, o.status, o.created_at, o.total,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS items,
            (SELECT product_title FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS first_item
       FROM orders o WHERE o.customer_id = ? AND o.status <> 'payment_failed'
      ORDER BY o.id DESC LIMIT ?`,
    [customerId, limit],
  );
  return rows.map((r) => ({
    orderNo: String(r.order_no),
    token: String(r.token),
    status: String(r.status),
    label: labelStatus(String(r.status)),
    createdAt: String(r.created_at),
    total: Number(r.total),
    items: Number(r.items),
    firstItem: r.first_item ? String(r.first_item) : null,
  }));
}
