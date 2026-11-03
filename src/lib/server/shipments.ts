import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { cancelShipment as npCancel, createShipment as npCreate, getCourierQuotes, trackShipment, type CourierQuote } from "./nimbuspost";
import { getOrderById, setOrderStatus, type Order } from "./orders";

export type Shipment = {
  id: number;
  awb: string | null;
  courier: string | null;
  status: string;
  labelUrl: string | null;
  weightGrams: number | null;
  createdAt: string;
  events: { status: string; location: string | null; message: string | null; at: string }[];
};

export async function listShipments(orderId: number): Promise<Shipment[]> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT * FROM shipments WHERE order_id = ? ORDER BY id DESC", [orderId]);
  if (!rows.length) return [];
  const [ev] = await db().query<RowDataPacket[]>(
    "SELECT shipment_id, status, location, message, event_at FROM shipment_events WHERE shipment_id IN (?) ORDER BY event_at DESC",
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => ({
    id: r.id,
    awb: r.awb,
    courier: r.courier,
    status: r.status,
    labelUrl: r.label_url,
    weightGrams: r.weight_grams,
    createdAt: r.created_at,
    events: ev
      .filter((e) => e.shipment_id === r.id)
      .map((e) => ({ status: e.status, location: e.location, message: e.message, at: e.event_at })),
  }));
}

const activeShipment = (s: Shipment[]) => s.find((x) => x.status !== "cancelled");

/** Courier options for an order (admin can pick any; cheapest is preselected). */
export async function quoteForOrder(order: Order, weightGrams: number, dims: { length: number; breadth: number; height: number }) {
  return getCourierQuotes({
    destination: order.address.pincode,
    weightGrams,
    paymentType: order.paymentMethod === "cod" ? "cod" : "prepaid",
    orderAmount: order.total,
    dims,
  });
}

const SHIPPABLE = new Set(["paid", "cod_pending", "confirmed"]);

export async function bookShipment(
  orderId: number,
  opts: { courierId?: string; weightGrams: number; dims: { length: number; breadth: number; height: number } },
): Promise<Shipment[]> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (!SHIPPABLE.has(order.status)) throw new Error(`Can't ship an order that is "${order.status}"`);
  if (activeShipment(await listShipments(orderId))) throw new Error("This order already has an active shipment");

  const a = order.address;
  const booked = await npCreate({
    orderNumber: order.orderNo,
    paymentType: order.paymentMethod === "cod" ? "cod" : "prepaid",
    orderAmount: order.total,
    shippingCharges: order.shipping,
    codCharges: order.codFee,
    discount: order.discount,
    weightGrams: opts.weightGrams,
    dims: opts.dims,
    courierId: opts.courierId,
    consignee: { name: a.name, address: a.line1, address_2: a.line2, city: a.city, state: a.state, pincode: a.pincode, phone: a.phone },
    items: order.items.map((i) => ({ name: `${i.productTitle} (${i.variantTitle})`, qty: i.quantity, price: i.unitPrice, sku: i.sku })),
  });

  await db().execute<ResultSetHeader>(
    `INSERT INTO shipments (order_id, provider_shipment_id, awb, courier, status, weight_grams, label_url)
     VALUES (?, ?, ?, ?, 'booked', ?, ?)`,
    [orderId, booked.shipmentId || null, booked.awb, booked.courierName || null, opts.weightGrams, booked.labelUrl],
  );
  await setOrderStatus(orderId, "packed", "admin", `Shipment booked: ${booked.courierName} AWB ${booked.awb}`);
  return listShipments(orderId);
}

export async function cancelOrderShipment(orderId: number): Promise<Shipment[]> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  const s = activeShipment(await listShipments(orderId));
  if (!s?.awb) throw new Error("No active shipment to cancel");
  if (["delivered", "rto"].includes(s.status)) throw new Error("Delivered/returned shipments can't be cancelled");
  await npCancel(s.awb);
  await db().execute("UPDATE shipments SET status = 'cancelled' WHERE id = ?", [s.id]);
  // Back to the pre-shipping state so it can be re-booked.
  await setOrderStatus(orderId, order.paymentMethod === "cod" ? "cod_pending" : "paid", "admin", `Shipment ${s.awb} cancelled`);
  return listShipments(orderId);
}

/** Map courier wording to our shipment + order statuses. */
export function normaliseStatus(raw: string): { shipment: string; order?: Order["status"] } {
  const s = raw.toLowerCase();
  if (/rto|return/.test(s)) return { shipment: "rto", order: "rto" };
  if (/deliver(ed)?$|^delivered/.test(s) && !/out for/.test(s)) return { shipment: "delivered", order: "delivered" };
  if (/out for delivery|ofd/.test(s)) return { shipment: "out_for_delivery", order: "shipped" };
  if (/transit|picked|shipped|dispatch/.test(s)) return { shipment: "in_transit", order: "shipped" };
  if (/cancel/.test(s)) return { shipment: "cancelled" };
  return { shipment: s.replace(/\s+/g, "_").slice(0, 30) || "booked" };
}

/** Apply a status update for an AWB (from tracking refresh or webhook). Idempotent. */
export async function applyTrackingUpdate(
  awb: string,
  status: string,
  events: { status: string; location: string | null; message: string | null; at: string }[],
  actor: "admin" | "nimbuspost",
) {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT id, order_id, status FROM shipments WHERE awb = ?", [awb]);
  const s = rows[0];
  if (!s) return false;
  const n = normaliseStatus(status);
  if (s.status !== "cancelled") {
    await db().execute(
      `UPDATE shipments SET status = ?, shipped_at = IF(? IN ('in_transit','out_for_delivery') AND shipped_at IS NULL, NOW(), shipped_at),
         delivered_at = IF(? = 'delivered', NOW(), delivered_at) WHERE id = ?`,
      [n.shipment, n.shipment, n.shipment, s.id],
    );
  }
  const valid = events.filter((e) => e.status && !Number.isNaN(new Date(e.at).getTime()));
  if (valid.length) {
    await db().execute("DELETE FROM shipment_events WHERE shipment_id = ?", [s.id]);
    await db().query("INSERT INTO shipment_events (shipment_id, status, location, message, event_at) VALUES ?", [
      valid.slice(0, 100).map((e) => [s.id, e.status.slice(0, 30), e.location?.slice(0, 120) ?? null, e.message?.slice(0, 255) ?? null, new Date(e.at)]),
    ]);
  }
  if (n.order && s.status !== "cancelled") await setOrderStatus(s.order_id, n.order, actor, `Courier: ${status}`);
  return true;
}

export async function refreshTracking(orderId: number): Promise<Shipment[]> {
  const s = activeShipment(await listShipments(orderId));
  if (!s?.awb) throw new Error("No active shipment");
  const t = await trackShipment(s.awb);
  if (!t) throw new Error("NimbusPost has no tracking for this AWB yet");
  await applyTrackingUpdate(s.awb, t.status, t.events, "admin");
  return listShipments(orderId);
}

export type { CourierQuote };
