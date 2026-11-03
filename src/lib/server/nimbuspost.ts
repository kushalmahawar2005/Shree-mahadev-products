import "server-only";
import { site } from "@/data/site";

/**
 * NimbusPost API v1 (https://api.nimbuspost.com/v1), per their Postman collection.
 * Auth: POST users/login {email,password} → Bearer token (valid for a few hours).
 * If only NIMBUSPOST_API_KEY is set we send it as the Bearer token. TODO(verify) with a live key.
 */
const API = "https://api.nimbuspost.com/v1";

export function nimbusConfigured() {
  return Boolean((process.env.NIMBUSPOST_EMAIL && process.env.NIMBUSPOST_PASSWORD) || process.env.NIMBUSPOST_API_KEY);
}

const g = globalThis as unknown as { __nimbusToken?: { value: string; exp: number } };

async function token(force = false): Promise<string> {
  if (!process.env.NIMBUSPOST_EMAIL && process.env.NIMBUSPOST_API_KEY) return process.env.NIMBUSPOST_API_KEY;
  if (!force && g.__nimbusToken && g.__nimbusToken.exp > Date.now()) return g.__nimbusToken.value;
  const res = await fetch(`${API}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.NIMBUSPOST_EMAIL, password: process.env.NIMBUSPOST_PASSWORD }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json()) as { status?: boolean; data?: string; message?: string };
  if (!json.status || !json.data) throw new Error(`NimbusPost login failed: ${json.message ?? res.status}`);
  g.__nimbusToken = { value: json.data, exp: Date.now() + 60 * 60 * 1000 };
  return json.data;
}

type NimbusResponse<T> = { status?: boolean; data?: T; message?: string };

/** Authenticated call; retries once with a fresh token on 401. */
async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}, retry = true): Promise<NimbusResponse<T>> {
  const res = await fetch(`${API}/${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 && retry && process.env.NIMBUSPOST_EMAIL) {
    await token(true);
    return call(path, init, false);
  }
  return (await res.json().catch(() => ({ status: false, message: `HTTP ${res.status}` }))) as NimbusResponse<T>;
}

// ───────────── Rates ─────────────

export type CourierQuote = {
  courierId: string;
  courierName: string;
  freight: number;
  codCharge: number;
  total: number;
  chargeableWeight?: number;
  edd?: string;
};

type RawCourier = {
  id?: string | number;
  name?: string;
  freight_charges?: number | string;
  cod_charges?: number | string;
  total_charges?: number | string;
  chargeable_weight?: number;
  edd?: string;
};

/** All couriers that serve `destination`, cheapest first. Empty array = not serviceable. */
export async function getCourierQuotes(input: {
  destination: string;
  weightGrams: number;
  paymentType: "cod" | "prepaid";
  orderAmount: number;
  dims?: { length: number; breadth: number; height: number };
}): Promise<CourierQuote[]> {
  const dims = input.dims ?? { length: 20, breadth: 15, height: 15 };
  const json = await call<RawCourier[]>("courier/serviceability", {
    method: "POST",
    body: {
      origin: pickup().pincode,
      destination: input.destination,
      payment_type: input.paymentType,
      order_amount: String(input.orderAmount),
      weight: String(Math.max(input.weightGrams, 100)),
      length: String(dims.length),
      breadth: String(dims.breadth),
      height: String(dims.height),
    },
  });
  if (!json.status || !Array.isArray(json.data)) return [];
  return json.data
    .map((c) => ({
      courierId: String(c.id ?? ""),
      courierName: c.name ?? "Courier",
      freight: Number(c.freight_charges ?? 0),
      codCharge: Number(c.cod_charges ?? 0),
      total: Number(c.total_charges ?? Number(c.freight_charges ?? 0) + Number(c.cod_charges ?? 0)),
      chargeableWeight: c.chargeable_weight,
      edd: c.edd,
    }))
    .filter((c) => c.courierId && Number.isFinite(c.total) && c.total > 0)
    .sort((a, b) => a.total - b.total);
}

// ───────────── Shipments ─────────────

/** Pickup point. warehouse_name must match the warehouse saved in the NimbusPost dashboard. */
function pickup() {
  return {
    warehouse_name: process.env.NIMBUSPOST_WAREHOUSE_NAME ?? "Swadeshi Mahadev Products",
    name: site.name,
    address: site.address.line1,
    address_2: `Dist. ${site.address.district}`,
    city: site.address.city,
    state: site.address.state,
    pincode: process.env.NIMBUSPOST_PICKUP_PINCODE ?? site.address.postalCode,
    phone: site.phone.replace(/\D/g, "").slice(-10),
  };
}

export type CreateShipmentInput = {
  orderNumber: string;
  paymentType: "cod" | "prepaid";
  orderAmount: number;
  shippingCharges: number;
  codCharges: number;
  discount: number;
  weightGrams: number;
  dims: { length: number; breadth: number; height: number };
  courierId?: string;
  consignee: { name: string; address: string; address_2?: string; city: string; state: string; pincode: string; phone: string };
  items: { name: string; qty: number; price: number; sku?: string }[];
};

export type BookedShipment = {
  shipmentId: string;
  awb: string;
  courierId: string;
  courierName: string;
  status: string;
  labelUrl: string | null;
};

export async function createShipment(i: CreateShipmentInput): Promise<BookedShipment> {
  const json = await call<{
    shipment_id?: number | string;
    awb_number?: string;
    courier_id?: string;
    courier_name?: string;
    status?: string;
    label?: string;
  }>("shipments", {
    method: "POST",
    body: {
      order_number: i.orderNumber,
      shipping_charges: i.shippingCharges,
      discount: i.discount,
      cod_charges: i.codCharges,
      payment_type: i.paymentType,
      order_amount: i.orderAmount,
      package_weight: i.weightGrams,
      package_length: i.dims.length,
      package_breadth: i.dims.breadth,
      package_height: i.dims.height,
      request_auto_pickup: "yes",
      consignee: i.consignee,
      pickup: pickup(),
      order_items: i.items.map((x) => ({ name: x.name, qty: String(x.qty), price: String(x.price), sku: x.sku ?? "" })),
      ...(i.courierId ? { courier_id: i.courierId } : {}),
      is_insurance: "0",
    },
  });
  const d = json.data;
  if (!json.status || !d?.awb_number) throw new Error(json.message || "NimbusPost could not book this shipment");
  return {
    shipmentId: String(d.shipment_id ?? ""),
    awb: d.awb_number,
    courierId: String(d.courier_id ?? i.courierId ?? ""),
    courierName: d.courier_name ?? "",
    status: d.status ?? "booked",
    labelUrl: d.label ?? null,
  };
}

export async function cancelShipment(awb: string): Promise<void> {
  const json = await call("shipments/cancel", { method: "POST", body: { awb } });
  if (!json.status) throw new Error(json.message || "NimbusPost could not cancel this shipment");
}

export type TrackingEvent = { status: string; location: string | null; message: string | null; at: string };

/** Current status + scan history. Field names are read defensively (not fully documented). */
export async function trackShipment(awb: string): Promise<{ status: string; events: TrackingEvent[] } | null> {
  const json = await call<Record<string, unknown>>(`shipments/track/${encodeURIComponent(awb)}`);
  if (!json.status || !json.data) return null;
  const d = json.data;
  const history = (d.history ?? d.scans ?? d.tracking_history ?? []) as Record<string, unknown>[];
  return {
    status: String(d.status ?? d.current_status ?? ""),
    events: Array.isArray(history)
      ? history.map((h) => ({
          status: String(h.status_code ?? h.status ?? ""),
          location: (h.location as string) ?? null,
          message: (h.message as string) ?? (h.status as string) ?? null,
          at: String(h.event_time ?? h.date ?? h.time ?? ""),
        }))
      : [],
  };
}

export async function createManifest(awbs: string[]): Promise<string | null> {
  const json = await call<string | { manifest?: string; url?: string }>("shipments/manifest", { method: "POST", body: { awbs } });
  if (!json.status) throw new Error(json.message || "Could not create manifest");
  const d = json.data;
  return typeof d === "string" ? d : (d?.manifest ?? d?.url ?? null);
}
