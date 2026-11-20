import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { kickOutbox, notifyOrder, queueOrderEmail } from "./mail";
import { queueOrderWhatsApp } from "./whatsapp";
import {
  actOnNdr,
  cancelShipment as npCancel,
  createManifest,
  createShipment as npCreate,
  getCourierQuotes,
  getLabelUrl,
  schedulePickup,
  trackShipment,
  type CourierQuote,
  type NdrAction,
  type NdrCase,
} from "./nimbuspost";
import { addOrderNote, flagOrder, getOrderById, inTx, setOrderStatus, type Order } from "./orders";
import { nimbusConfigured } from "./nimbuspost";
import {
  cancelVelocityShipment,
  createVelocityShipment,
  getVelocityQuotes,
  trackVelocityShipment,
  velocityConfigured,
} from "./velocity";

/** Velocity courier ids carry this prefix in quotes / booking so one id field covers both providers. */
const VEL = "V-";

export type Shipment = {
  id: number;
  provider: "nimbuspost" | "velocity";
  awb: string | null;
  courier: string | null;
  status: string;
  expectedDelivery: string | null;
  labelUrl: string | null;
  trackingUrl: string | null;
  pickupRequested: boolean;
  charged: number | null;
  weightGrams: number | null;
  createdAt: string;
  events: { status: string; location: string | null; message: string | null; at: string }[];
};

export async function listShipments(orderId: number): Promise<Shipment[]> {
  // Every column except label_pdf (a stored PDF; only the label route reads it).
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT id, provider, awb, courier, status, estimated_delivery, label_url, tracking_url, pickup_requested, charged,
       weight_grams, created_at FROM shipments WHERE order_id = ? ORDER BY id DESC`,
    [orderId],
  );
  if (!rows.length) return [];
  const [ev] = await db().query<RowDataPacket[]>(
    "SELECT shipment_id, status, location, message, event_at FROM shipment_events WHERE shipment_id IN (?) ORDER BY event_at DESC",
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider === "velocity" ? ("velocity" as const) : ("nimbuspost" as const),
    awb: r.awb,
    courier: r.courier,
    status: r.status,
    expectedDelivery: r.estimated_delivery ? String(r.estimated_delivery).slice(0, 10) : null,
    labelUrl: r.label_url,
    trackingUrl: r.tracking_url,
    pickupRequested: !!r.pickup_requested,
    charged: r.charged,
    weightGrams: r.weight_grams,
    createdAt: r.created_at,
    events: ev
      .filter((e) => e.shipment_id === r.id)
      .map((e) => ({ status: e.status, location: e.location, message: e.message, at: e.event_at })),
  }));
}

const activeShipment = (s: Shipment[]) => s.find((x) => x.status !== "cancelled");

/**
 * Courier options from NimbusPost and Velocity together, cheapest first (the admin can pick any; the
 * cheapest is preselected). One provider failing still returns the other's couriers.
 */
export async function quoteForOrder(order: Order, weightGrams: number, dims: { length: number; breadth: number; height: number }): Promise<CourierQuote[]> {
  const input = {
    destination: order.address.pincode,
    weightGrams,
    paymentType: (order.paymentMethod === "cod" ? "cod" : "prepaid") as "cod" | "prepaid",
    orderAmount: order.total,
    dims,
  };
  const [np, vel] = await Promise.allSettled([
    nimbusConfigured() ? getCourierQuotes(input) : Promise.resolve([] as CourierQuote[]),
    velocityConfigured() ? getVelocityQuotes(input) : Promise.resolve([]),
  ]);
  const out: CourierQuote[] = [];
  if (np.status === "fulfilled") out.push(...np.value);
  else console.error("NimbusPost quotes failed", np.reason);
  if (vel.status === "fulfilled")
    out.push(
      ...vel.value.map((q) => ({
        provider: "velocity" as const,
        courierId: `${VEL}${q.carrierId}`,
        courierName: q.carrierName,
        freight: q.freight,
        codCharge: q.codCharge,
        total: q.total,
        edd: q.edd,
      })),
    );
  else console.error("Velocity quotes failed", vel.reason);
  if (!out.length && np.status === "rejected" && vel.status === "rejected") throw np.reason;
  return out.sort((a, b) => a.total - b.total);
}

const SHIPPABLE = new Set(["paid", "cod_pending", "confirmed"]);

/** fetch timeout / network failure: NimbusPost may have acted, so the outcome is unknown. */
const isUncertain = (e: unknown) =>
  e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError" || (e instanceof TypeError && /fetch/i.test(e.message)));

/**
 * Book a NimbusPost shipment, at most once per order:
 * 1. Claim: in a transaction with the order row locked, check it is shippable and has no live
 *    shipment, then insert a `booking` row. A concurrent call waits on the lock, sees that row and stops.
 * 2. Commit, then call NimbusPost (never while holding the lock).
 * 3. Success fills in the claim row. A clear API rejection cancels the claim (re-bookable) and logs it.
 *    A timeout leaves the claim in `booking` and flags the order: the parcel may exist at NimbusPost.
 */
export async function bookShipment(
  orderId: number,
  opts: { courierId?: string; weightGrams: number; dims: { length: number; breadth: number; height: number } },
): Promise<Shipment[]> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  const viaVelocity = Boolean(opts.courierId?.startsWith(VEL));
  const provider = viaVelocity ? "Velocity" : "NimbusPost";

  const claimId = await inTx(async (conn) => {
    const [[o]] = await conn.execute<RowDataPacket[]>("SELECT status FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!o) throw new Error("Order not found");
    if (!SHIPPABLE.has(String(o.status))) throw new Error(`Can't ship an order that is "${o.status}"`);
    const [live] = await conn.execute<RowDataPacket[]>(
      "SELECT status FROM shipments WHERE order_id = ? AND status <> 'cancelled' LIMIT 1",
      [orderId],
    );
    if (live.length)
      throw new Error(live[0].status === "booking" ? "A shipment booking for this order is already in progress" : "This order already has an active shipment");
    const [ins] = await conn.execute<ResultSetHeader>(
      "INSERT INTO shipments (order_id, provider, status, weight_grams) VALUES (?, ?, 'booking', ?)",
      [orderId, viaVelocity ? "velocity" : "nimbuspost", opts.weightGrams],
    );
    return ins.insertId;
  });

  const a = order.address;
  const items = order.items.map((i) => ({ name: `${i.productTitle} (${i.variantTitle})`, qty: i.quantity, price: i.unitPrice, sku: i.sku }));
  const createVelocity = (orderNumber: string) =>
    createVelocityShipment({
      orderNumber,
      orderDate: new Date(order.createdAt),
      paymentType: order.paymentMethod === "cod" ? "cod" : "prepaid",
      orderAmount: order.total,
      weightGrams: opts.weightGrams,
      dims: opts.dims,
      carrierId: opts.courierId!.slice(VEL.length),
      consignee: { name: a.name, email: a.email, address: a.line1, address_2: a.line2, city: a.city, state: a.state, pincode: a.pincode, phone: a.phone },
      items,
    }).then((v) => ({
      providerOrderId: v.shipmentId,
      awb: v.awb,
      courierId: opts.courierId!,
      courierName: v.courierName,
      status: "booked",
      labelUrl: v.labelUrl,
      trackingUrl: null as string | null,
      charged: v.charged,
      pickupGenerated: v.pickupGenerated,
      expectedDelivery: null as string | null,
    }));
  const create = (orderNumber: string) => viaVelocity ? createVelocity(orderNumber) : npCreate({
    orderNumber,
    paymentType: order.paymentMethod === "cod" ? "cod" : "prepaid",
    orderAmount: order.total,
    shippingCharges: order.shipping,
    codCharges: order.codFee,
    discount: order.discount,
    weightGrams: opts.weightGrams,
    dims: opts.dims,
    courierId: opts.courierId,
    consignee: { name: a.name, email: a.email, address: a.line1, address_2: a.line2, city: a.city, state: a.state, pincode: a.pincode, phone: a.phone },
    items,
  });
  // NimbusPost keeps an order number for good, even after its shipment is cancelled. A re-booked order (or a
  // number reused after a test reset) gets "already exists": retry as SMP1002-2, SMP1002-3 … Safe because the
  // claim above guarantees we hold no other live shipment for this order (a timed-out booking keeps its claim).
  let booked: Awaited<ReturnType<typeof create>> | undefined;
  try {
    for (let n = 1; !booked; n++) {
      try {
        booked = await create(n === 1 ? order.orderNo : `${order.orderNo}-${n}`);
      } catch (e) {
        if (n >= 6 || !/already exists|duplicate|already been taken/i.test(e instanceof Error ? e.message : "")) throw e;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isUncertain(e)) {
      await flagOrder(
        db(),
        orderId,
        `Shipment booking timed out (${msg.slice(0, 100)}). Check ${provider} for order ${order.orderNo}: if no shipment exists there, cancel the stuck "booking" shipment here and book again.`,
        "nimbuspost",
      );
    } else {
      await db().execute("UPDATE shipments SET status = 'cancelled' WHERE id = ? AND status = 'booking'", [claimId]);
      await addOrderNote(orderId, "nimbuspost", `Shipment booking failed: ${msg.slice(0, 200)}`);
    }
    throw e;
  }

  const expectedDelivery = booked.expectedDelivery && !Number.isNaN(new Date(booked.expectedDelivery).getTime())
    ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(booked.expectedDelivery))
    : null;

  let pickup = booked.pickupGenerated;
  if (!pickup && booked.providerOrderId && !viaVelocity) {
    pickup = await schedulePickup(booked.providerOrderId).then(
      (scheduled) => scheduled,
      (e) => (console.error("schedulePickup failed", e), false),
    );
  }
  try {
    await db().execute<ResultSetHeader>(
      `UPDATE shipments SET provider_shipment_id = ?, awb = ?, courier = ?, status = 'booked', estimated_delivery = ?, label_url = ?,
         tracking_url = ?, pickup_requested = ?, charged = ? WHERE id = ? AND status = 'booking'`,
      [booked.providerOrderId || null, booked.awb, booked.courierName || null, expectedDelivery, booked.labelUrl,
       booked.trackingUrl, pickup ? 1 : 0, booked.charged, claimId],
    );
  } catch (e) {
    // Booked at NimbusPost but we couldn't save it: never lose the AWB.
    await flagOrder(db(), orderId, `Shipment booked at ${provider} (AWB ${booked.awb}) but saving it failed: ${(e as Error).message.slice(0, 120)}`, "nimbuspost");
    throw e;
  }
  // Velocity label links expire after an hour and there is no API to get a fresh one: keep the PDF.
  if (viaVelocity && booked.labelUrl) await storeLabelPdf(claimId, booked.labelUrl);
  const changed = await setOrderStatus(orderId, "packed", "admin", `Shipment booked (${provider}): ${booked.courierName} AWB ${booked.awb}`);
  if (changed) {
    await notifyOrder(orderId, "shipped");
    await queueOrderWhatsApp(orderId, "shipped").catch((error) => console.error("WhatsApp shipment notification", error));
  }
  return listShipments(orderId);
}

/** Shipments that may still be cancelled at NimbusPost (the parcel has not left with the courier). */
const CANCELLABLE = new Set(["booked"]);

/**
 * Cancel the order's live shipment. Only before pickup (`booked`), or a stuck `booking` claim with no AWB
 * (admin has confirmed nothing exists at NimbusPost). The order goes back to its pre-shipping status only
 * if it is still `packed`: a cancelled / refunded order is never revived.
 */
export async function cancelOrderShipment(orderId: number): Promise<Shipment[]> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");
  const s = activeShipment(await listShipments(orderId));
  if (!s) throw new Error("No active shipment to cancel");

  if (s.status === "booking" && !s.awb) {
    const [r] = await db().execute<ResultSetHeader>("UPDATE shipments SET status = 'cancelled' WHERE id = ? AND status = 'booking'", [s.id]);
    if (r.affectedRows) await addOrderNote(orderId, "admin", "Stuck shipment booking cleared by admin");
    return listShipments(orderId);
  }
  if (!s.awb) throw new Error("No active shipment to cancel");
  if (!CANCELLABLE.has(s.status))
    throw new Error("This parcel is already with the courier, so the shipment can't be cancelled. Handle it as a return (RTO) instead.");

  if (s.provider === "velocity") await cancelVelocityShipment(s.awb);
  else await npCancel(s.awb, "Cancelled by seller from admin");
  const [r] = await db().execute<ResultSetHeader>("UPDATE shipments SET status = 'cancelled' WHERE id = ? AND status <> 'cancelled'", [s.id]);
  if (!r.affectedRows) return listShipments(orderId); // another request already cancelled it

  const back = order.paymentMethod === "cod" ? "cod_pending" : "paid";
  const reverted = await setOrderStatus(orderId, back, "admin", `Shipment ${s.awb} cancelled`, { onlyFrom: ["packed"] });
  if (!reverted) await addOrderNote(orderId, "admin", `Shipment ${s.awb} cancelled (order stays "${order.status}")`);
  return listShipments(orderId);
}

/** Map courier wording to our shipment + order statuses. */
export function normaliseStatus(raw: string): { shipment: string; order?: Order["status"] } {
  const s = raw.toLowerCase().replace(/_/g, " ");
  if (/rto|return/.test(s)) return { shipment: "rto", order: "rto" };
  if (/deliver(ed)?$|^delivered/.test(s) && !/out for/.test(s)) return { shipment: "delivered", order: "delivered" };
  if (/out for delivery|ofd/.test(s)) return { shipment: "out_for_delivery", order: "shipped" };
  // Delivery attempted but failed (customer unavailable, wrong address, refused…): courier "NDR".
  if (/ndr|undelivered|not delivered|delivery attempt|attempt(ed)? (failed|unsuccessful)|failed delivery|customer (not available|unavailable)|consignee (not available|unavailable)|refused|exception/.test(s)) {
    return { shipment: "ndr", order: "shipped" };
  }
  if (/transit|picked|pickup completed|reached at destination|shipped|dispatch/.test(s)) {
    return { shipment: "in_transit", order: "shipped" };
  }
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
      `UPDATE shipments SET status = ?, shipped_at = IF(? AND shipped_at IS NULL, NOW(), shipped_at),
         delivered_at = IF(?, NOW(), delivered_at) WHERE id = ?`,
      // Flags computed here: "? = 'literal'" hits a collation mix on live MariaDB.
      [n.shipment, ["in_transit", "out_for_delivery", "ndr"].includes(n.shipment) ? 1 : 0, n.shipment === "delivered" ? 1 : 0, s.id],
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
  // Tell the customer when the parcel is out for delivery, and each day a delivery attempt fails.
  if (s.status !== "cancelled" && n.shipment !== s.status && (n.shipment === "out_for_delivery" || n.shipment === "ndr")) {
    const orderId = Number(s.order_id);
    const day = new Date().toISOString().slice(0, 10);
    if (n.shipment === "out_for_delivery") {
      await queueOrderWhatsApp(orderId, "out_for_delivery", day).catch((e) => console.error("WhatsApp out for delivery", e));
      await queueOrderEmail(orderId, "out_for_delivery", { dedupeSuffix: day }).catch((e) => console.error("Email out for delivery", e));
    } else {
      await queueOrderWhatsApp(orderId, "delivery_failed", day).catch((e) => console.error("WhatsApp delivery failed", e));
      await queueOrderEmail(orderId, "delivery_failed", { dedupeSuffix: day }).catch((e) => console.error("Email delivery failed", e));
    }
    kickOutbox();
  }
  return true;
}

export async function refreshTracking(orderId: number): Promise<Shipment[]> {
  const s = activeShipment(await listShipments(orderId));
  if (!s?.awb) throw new Error("No active shipment");
  const t = s.provider === "velocity" ? await trackVelocityShipment(s.awb) : await trackShipment(s.awb);
  await applyTrackingUpdate(s.awb, t.status, t.events, "admin");
  if (t.trackingUrl) await db().execute("UPDATE shipments SET tracking_url = ? WHERE id = ?", [t.trackingUrl, s.id]);
  return listShipments(orderId);
}

export async function refreshStaleTracking() {
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT DISTINCT order_id FROM shipments
     WHERE status NOT IN ('delivered', 'rto', 'cancelled')
       AND updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ORDER BY updated_at ASC LIMIT 100`,
  );
  let refreshed = 0;
  const errors: { orderId: number; error: string }[] = [];
  for (const row of rows) {
    const orderId = Number(row.order_id);
    try {
      await refreshTracking(orderId);
      refreshed++;
    } catch (error) {
      errors.push({ orderId, error: error instanceof Error ? error.message : "Tracking refresh failed" });
    }
  }
  return { found: rows.length, refreshed, errors };
}

export async function listNdrCases(): Promise<NdrCase[]> {
  const { nimbusConfigured } = await import("./nimbuspost");
  if (!nimbusConfigured()) return [];
  const { listNdr } = await import("./nimbuspost");
  return listNdr();
}

export async function applyNdrAction(awb: string, action: NdrAction, details?: { address?: string; phone?: string }) {
  await actOnNdr(awb, action, details);
  if (action === "rto") {
    await applyTrackingUpdate(awb, "rto", [], "admin");
  }
  return true;
}

export async function createDailyManifest(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT awb FROM shipments
     WHERE awb IS NOT NULL AND status NOT IN ('cancelled', 'delivered', 'rto')
       AND DATE(created_at) = ? ORDER BY id`,
    [day],
  );
  const result = await createManifest({ awbs: rows.map((row) => String(row.awb)) });
  return { date: day, count: rows.length, ...result };
}

async function active(orderId: number) {
  const s = activeShipment(await listShipments(orderId));
  if (!s) throw new Error("No active shipment");
  const [r] = await db().execute<RowDataPacket[]>("SELECT provider_shipment_id FROM shipments WHERE id = ?", [s.id]);
  return { ...s, providerOrderId: (r[0]?.provider_shipment_id as string) ?? "" };
}

/** Saves a Velocity label PDF in the shipment row (their link expires in an hour). Never throws. */
async function storeLabelPdf(shipmentId: number, url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pdf = Buffer.from(await res.arrayBuffer());
    if (pdf.length > 5_000_000) throw new Error("label too large");
    await db().execute("UPDATE shipments SET label_pdf = ? WHERE id = ?", [pdf, shipmentId]);
  } catch (e) {
    console.error("Velocity label download failed", shipmentId, e);
  }
}

/** Stored label PDF for the admin download route. */
export async function labelPdf(shipmentId: number): Promise<Buffer | null> {
  const [[r]] = await db().query<RowDataPacket[]>("SELECT label_pdf FROM shipments WHERE id = ?", [shipmentId]);
  return r?.label_pdf ? Buffer.from(r.label_pdf) : null;
}

/** Fresh label PDF link (NimbusPost label links expire; Velocity labels are served from our copy). */
export async function labelForOrder(orderId: number): Promise<string> {
  const s = await active(orderId);
  if (s.provider === "velocity") {
    if (await labelPdf(s.id)) return `/api/admin/shipments/${s.id}/label`;
    if (s.labelUrl) return s.labelUrl;
    throw new Error("Label not available. Download it from the Velocity dashboard.");
  }
  const url = (s.providerOrderId && (await getLabelUrl(s.providerOrderId))) || s.labelUrl;
  if (!url) throw new Error("Label not available yet");
  return url;
}

export async function requestPickup(orderId: number): Promise<Shipment[]> {
  const s = await active(orderId);
  if (s.provider === "velocity") throw new Error("Velocity books the pickup with the shipment. Check the Velocity dashboard → Pickups.");
  if (!s.providerOrderId) throw new Error("Missing NimbusPost order id");
  const scheduled = await schedulePickup(s.providerOrderId);
  if (!scheduled) throw new Error("NimbusPost has not confirmed the pickup yet. Please try again or contact NimbusPost support.");
  await db().execute("UPDATE shipments SET pickup_requested = 1 WHERE id = ?", [s.id]);
  return listShipments(orderId);
}

export type { CourierQuote };
