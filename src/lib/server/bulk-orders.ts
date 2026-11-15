import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/server/db";
import { getOrderById, setOrderStatus, listOrders, type OrderFilter } from "@/lib/server/orders";
import { bookShipment, cancelOrderShipment, labelForOrder, quoteForOrder } from "@/lib/server/shipments";
import { estimateWeightGrams } from "@/lib/server/shipping";

export type BulkResult = { id: number; orderNo: string; ok: boolean; message: string };

/** Packed weight from the catalog (variant weight, else estimated from the size) + a box that fits. */
async function parcelFor(orderId: number) {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT oi.quantity, v.weight_grams, v.size_value, v.size_unit
       FROM order_items oi LEFT JOIN product_variants v ON v.variant_key = oi.variant_key
      WHERE oi.order_id = ?`,
    [orderId],
  );
  let weightGrams = 0;
  for (const r of rows) {
    const qty = Number(r.quantity);
    weightGrams += r.weight_grams
      ? Number(r.weight_grams) * qty
      : r.size_value
        ? estimateWeightGrams(Number(r.size_value), r.size_unit === "g" ? "g" : "ml", qty)
        : 500 * qty;
  }
  weightGrams = Math.max(100, Math.round(weightGrams));
  const dims =
    weightGrams <= 1500 ? { length: 20, breadth: 15, height: 15 }
    : weightGrams <= 5000 ? { length: 25, breadth: 20, height: 20 }
    : weightGrams <= 10000 ? { length: 30, breadth: 25, height: 25 }
    : { length: 35, breadth: 30, height: 30 };
  return { weightGrams, dims };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Failed").slice(0, 160);

/** Books every selected order with its cheapest courier, one after another (NimbusPost rate limits). */
export async function bulkBookShipments(ids: number[]): Promise<BulkResult[]> {
  const out: BulkResult[] = [];
  for (const id of ids) {
    const order = await getOrderById(id);
    if (!order) {
      out.push({ id, orderNo: `#${id}`, ok: false, message: "Order not found" });
      continue;
    }
    try {
      const parcel = await parcelFor(id);
      const quotes = await quoteForOrder(order, parcel.weightGrams, parcel.dims);
      const cheapest = [...quotes].sort((a, b) => a.total - b.total)[0];
      if (!cheapest) throw new Error("No courier serves this pincode");
      const shipments = await bookShipment(id, { courierId: cheapest.courierId, ...parcel });
      const s = shipments.find((x) => x.status !== "cancelled");
      out.push({ id, orderNo: order.orderNo, ok: true, message: `${s?.courier ?? cheapest.courierName} · AWB ${s?.awb ?? "—"}` });
    } catch (e) {
      out.push({ id, orderNo: order.orderNo, ok: false, message: errText(e) });
    }
  }
  return out;
}

/** Cancels the booked (not yet picked up) shipment of each order; the order goes back to "to ship". */
export async function bulkCancelShipments(ids: number[]): Promise<BulkResult[]> {
  const out: BulkResult[] = [];
  for (const id of ids) {
    const order = await getOrderById(id);
    if (!order) {
      out.push({ id, orderNo: `#${id}`, ok: false, message: "Order not found" });
      continue;
    }
    if (order.status !== "packed") {
      out.push({ id, orderNo: order.orderNo, ok: false, message: order.status === "shipped" ? "Already picked up by the courier: can't cancel" : `Skipped: no booked shipment` });
      continue;
    }
    try {
      await cancelOrderShipment(id);
      out.push({ id, orderNo: order.orderNo, ok: true, message: "Shipment cancelled, back in To ship" });
    } catch (e) {
      out.push({ id, orderNo: order.orderNo, ok: false, message: errText(e) });
    }
  }
  return out;
}

/** Status moves that are safe to do in bulk, and which statuses they apply to. */
export const BULK_STATUS = {
  confirmed: { from: ["cod_pending"], label: "Confirm COD" },
  delivered: { from: ["shipped"], label: "Mark delivered" },
} as const;
export type BulkStatus = keyof typeof BULK_STATUS;

export async function bulkSetStatus(ids: number[], status: BulkStatus): Promise<BulkResult[]> {
  const rule = BULK_STATUS[status];
  const out: BulkResult[] = [];
  for (const id of ids) {
    const order = await getOrderById(id);
    if (!order) {
      out.push({ id, orderNo: `#${id}`, ok: false, message: "Order not found" });
      continue;
    }
    if (!(rule.from as readonly string[]).includes(order.status)) {
      out.push({ id, orderNo: order.orderNo, ok: false, message: `Skipped: order is "${order.status}"` });
      continue;
    }
    try {
      await setOrderStatus(id, status, "admin", `Bulk: ${rule.label}`);
      out.push({ id, orderNo: order.orderNo, ok: true, message: rule.label });
    } catch (e) {
      out.push({ id, orderNo: order.orderNo, ok: false, message: errText(e) });
    }
  }
  return out;
}

/** Fresh label PDF links for the selected orders (orders without a shipment are skipped). */
export async function labelUrls(ids: number[]) {
  const urls: string[] = [];
  const skipped: number[] = [];
  for (const id of ids) {
    try {
      urls.push(await labelForOrder(id));
    } catch {
      skipped.push(id);
    }
  }
  return { urls, skipped };
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every order in the view (all pages) as CSV: one row per order, items joined. */
export async function ordersCsv(opts: { filter: OrderFilter; q?: string; from?: string; to?: string }) {
  const rows: string[] = [
    ["Order no", "Placed", "Status", "Payment", "Customer", "Phone", "Email", "City", "State", "Pincode", "Items", "Units", "Subtotal", "Discount", "Shipping", "COD fee", "Total"].join(","),
  ];
  for (let page = 1; page <= 100; page++) {
    const r = await listOrders({ ...opts, page, perPage: 100 });
    for (const o of r.orders) {
      rows.push(
        [
          o.orderNo,
          o.createdAt,
          o.status,
          o.paymentMethod,
          o.address.name,
          o.address.phone,
          o.address.email,
          o.address.city,
          o.address.state,
          o.address.pincode,
          o.items.map((i) => `${i.quantity} x ${i.productTitle} (${i.variantTitle})`).join(" | "),
          o.items.reduce((n, i) => n + i.quantity, 0),
          o.subtotal,
          o.discount,
          o.shipping,
          o.codFee,
          o.total,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    if (page * r.perPage >= r.total) break;
  }
  return rows.join("\n");
}
