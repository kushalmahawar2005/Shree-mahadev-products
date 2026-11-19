import "server-only";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/server/db";
import { getOrderById, setOrderStatus, listOrders, type OrderFilter } from "@/lib/server/orders";
import { bookShipment, cancelOrderShipment, labelForOrder, quoteForOrder } from "@/lib/server/shipments";
import { parcelFor, type PackLine } from "@/lib/packaging";

export type BulkResult = { id: number; orderNo: string; ok: boolean; message: string };

/** Weight + box from the packaging sheet (a variant weight set in admin wins for the weight). */
async function orderParcel(orderId: number) {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT oi.quantity, oi.product_handle, v.weight_grams, v.size_value, v.size_unit
       FROM order_items oi LEFT JOIN product_variants v ON v.variant_key = oi.variant_key
      WHERE oi.order_id = ?`,
    [orderId],
  );
  let fixed = 0;
  const all: PackLine[] = [];
  const sheet: PackLine[] = [];
  for (const r of rows) {
    const qty = Number(r.quantity);
    if (!r.size_value) {
      fixed += 500 * qty; // variant deleted since: rough guess, admin can fix in the order
      continue;
    }
    const line: PackLine = { handle: String(r.product_handle), sizeValue: Number(r.size_value), sizeUnit: r.size_unit === "g" ? "g" : "ml", qty };
    all.push(line);
    if (r.weight_grams) fixed += Number(r.weight_grams) * qty;
    else sheet.push(line);
  }
  const weightGrams = Math.max(100, Math.round(fixed + (sheet.length ? parcelFor(sheet).grams : 0)));
  const dims = all.length ? parcelFor(all).box : { length: 20, breadth: 15, height: 15 };
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
      const parcel = await orderParcel(id);
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
