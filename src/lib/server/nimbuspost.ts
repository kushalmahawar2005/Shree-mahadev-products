import "server-only";

/**
 * NimbusPost Partner API v2 — https://api-v2.nimbuspost.com/docs/reference/v2
 * Auth: x-api-key (npk_…) + x-api-secret on every request (Settings → API Keys, role admin).
 * Money in rate responses is in paise. Rate limit: 60 req/min per key.
 */
const API = "https://api-v2.nimbuspost.com/v2";

export function nimbusConfigured() {
  return Boolean(process.env.NIMBUSPOST_API_KEY && process.env.NIMBUSPOST_API_SECRET);
}

type Envelope<T> = { success?: boolean; data?: T; error?: { detail?: string; title?: string; code?: string }; message?: string };

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  if (!nimbusConfigured()) throw new Error("NimbusPost is not configured");
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "x-api-key": process.env.NIMBUSPOST_API_KEY ?? "",
      "x-api-secret": process.env.NIMBUSPOST_API_SECRET ?? "",
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || !json.success) {
    const msg = json.error?.detail || json.error?.title || json.message || `NimbusPost error (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return json.data as T;
}

export type NdrCase = {
  awb: string;
  orderNumber: string | null;
  status: string;
  reason: string | null;
  attemptDate: string | null;
  customerName: string | null;
  phone: string | null;
  address: string | null;
};

function ndrRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["ndr", "items", "rows", "data"]) {
      if (Array.isArray(o[key])) return o[key] as Record<string, unknown>[];
    }
  }
  return [];
}

export async function listNdr(): Promise<NdrCase[]> {
  const data = await call<unknown>("/ndr");
  return ndrRows(data).map((row) => ({
    awb: String(row.awb ?? row.awb_number ?? ""),
    orderNumber: row.order_number ? String(row.order_number) : null,
    status: String(row.status ?? row.ndr_status ?? "ndr"),
    reason: row.reason ? String(row.reason) : row.remark ? String(row.remark) : null,
    attemptDate: row.attempt_date ? String(row.attempt_date) : null,
    customerName: row.customer_name ? String(row.customer_name) : row.name ? String(row.name) : null,
    phone: row.phone ? String(row.phone) : null,
    address: row.address ? String(row.address) : null,
  })).filter((row) => row.awb);
}

export type NdrAction = "reattempt" | "change_address_phone" | "rto";

export async function actOnNdr(
  awb: string,
  action: NdrAction,
  details?: { address?: string; phone?: string },
) {
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(awb)) throw new Error("Invalid AWB");
  return call<unknown>(`/ndr/${encodeURIComponent(awb)}/action`, {
    method: "POST",
    body: {
      action,
      ...(details?.address ? { address: details.address } : {}),
      ...(details?.phone ? { phone: details.phone } : {}),
    },
  });
}

export async function createManifest(input: { awbs: string[] }): Promise<{ url: string | null; manifestId: string | null }> {
  const awbs = input.awbs.filter((awb) => /^[A-Za-z0-9_-]{3,60}$/.test(awb));
  if (!awbs.length) throw new Error("Select at least one booked shipment");
  const data = await call<Record<string, unknown>>("/manifests", {
    method: "POST",
    body: { awbs },
  });
  const nested = (data.data && typeof data.data === "object" ? data.data : data) as Record<string, unknown>;
  return {
    url: typeof nested.url === "string" ? nested.url : typeof nested.manifest_url === "string" ? nested.manifest_url : null,
    manifestId: typeof nested.id === "string" ? nested.id : typeof nested.manifest_id === "string" ? nested.manifest_id : null,
  };
}

const pickupPincode = () => process.env.NIMBUSPOST_PICKUP_PINCODE ?? "305624";

// ───────────── Warehouse ─────────────

const g = globalThis as unknown as { __nimbusWarehouse?: string };

/** Primary pickup warehouse id (or NIMBUSPOST_WAREHOUSE_ID). */
async function warehouseId(): Promise<string> {
  if (process.env.NIMBUSPOST_WAREHOUSE_ID) return process.env.NIMBUSPOST_WAREHOUSE_ID;
  if (g.__nimbusWarehouse) return g.__nimbusWarehouse;
  const list = await call<{ warehouse_id: string; name: string; status: string; is_primary: boolean }[]>("/warehouses");
  const wanted = process.env.NIMBUSPOST_WAREHOUSE_NAME?.trim().toLowerCase();
  const w =
    list.find((x) => wanted && x.name.trim().toLowerCase() === wanted && x.status === "active") ??
    list.find((x) => x.is_primary && x.status === "active") ??
    list.find((x) => x.status === "active");
  if (!w) throw new Error("No active pickup warehouse in NimbusPost");
  g.__nimbusWarehouse = w.warehouse_id;
  return w.warehouse_id;
}

// ───────────── Rates ─────────────

export type CourierQuote = {
  courierId: string;
  courierName: string;
  freight: number; // ₹
  codCharge: number; // ₹
  total: number; // ₹ (what the wallet is charged)
  tatDays?: number;
  edd?: string;
};

type Available = {
  courierId: string;
  courierName: string;
  courierDisplayName?: string;
  tatDays?: number;
  result?: { shippingChargesPaise?: number; codChargesPaise?: number; surchargesPaise?: number; totalPaise?: number };
};

/** All couriers that serve `destination`, cheapest first. Empty array = not serviceable. */
export async function getCourierQuotes(input: {
  destination: string;
  weightGrams: number;
  paymentType: "cod" | "prepaid";
  orderAmount: number;
  dims?: { length: number; breadth: number; height: number };
}): Promise<CourierQuote[]> {
  const d = input.dims ?? { length: 20, breadth: 15, height: 15 };
  const data = await call<{ available?: Available[] }>("/serviceability", {
    method: "POST",
    body: {
      pickupPincode: pickupPincode(),
      deliveryPincode: input.destination,
      paymentMode: input.paymentType,
      packages: [{ weight: Math.max(Math.round(input.weightGrams), 50), length: d.length, width: d.breadth, height: d.height }],
      orderValuePaise: Math.round(input.orderAmount * 100),
      sortBy: "cheapest",
    },
  });
  const rupees = (p?: number) => Math.round(p ?? 0) / 100;
  return (data.available ?? [])
    .map((c) => ({
      courierId: c.courierId,
      courierName: c.courierDisplayName || c.courierName,
      freight: rupees((c.result?.shippingChargesPaise ?? 0) + (c.result?.surchargesPaise ?? 0)),
      codCharge: rupees(c.result?.codChargesPaise),
      total: rupees(c.result?.totalPaise),
      tatDays: c.tatDays,
      edd: c.tatDays ? `${c.tatDays}–${c.tatDays + 1} days` : undefined,
    }))
    .filter((c) => c.courierId && c.total > 0)
    .sort((a, b) => a.total - b.total);
}

// ───────────── Shipments ─────────────

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
  consignee: { name: string; email?: string; address: string; address_2?: string; city: string; state: string; pincode: string; phone: string };
  items: { name: string; qty: number; price: number; sku?: string }[];
};

export type BookedShipment = {
  providerOrderId: string;
  awb: string;
  courierId: string;
  courierName: string;
  status: string;
  labelUrl: string | null;
  trackingUrl: string | null;
  charged: number | null;
  pickupGenerated: boolean;
};

type Booking = {
  order_id?: string;
  awb?: string;
  courier_id?: string;
  courier_name?: string;
  order_status?: string;
  label_url?: string;
  tracking_url?: string;
  tracking_short_url?: string;
  price?: { total?: number };
  pickup_generated?: boolean;
};

/** Create the NimbusPost order and book a courier in one call. */
export async function createShipment(i: CreateShipmentInput): Promise<BookedShipment> {
  const c = i.consignee;
  const data = await call<{ order?: { order_id?: string }; booking?: Booking }>("/shipments", {
    method: "POST",
    body: {
      order_number: i.orderNumber,
      order_type: "b2c",
      payment_mode: i.paymentType,
      order_amount: i.orderAmount,
      ...(i.paymentType === "cod" ? { order_collectable_amount: i.orderAmount } : {}),
      warehouse_id: await warehouseId(),
      shipping_address: {
        name: c.name,
        ...(c.email ? { email: c.email } : {}),
        address: c.address,
        ...(c.address_2 ? { address_opt: c.address_2 } : {}),
        pincode: Number(c.pincode),
        city: c.city,
        state: c.state,
        country: "India",
        phone: Number(c.phone),
      },
      billing_same_as_shipping: true,
      items: i.items.map((x) => ({ name: x.name.slice(0, 200), qty: x.qty, price: x.price, ...(x.sku ? { sku: x.sku } : {}) })),
      package: { weight: i.weightGrams, length: i.dims.length, width: i.dims.breadth, height: i.dims.height },
      org_charges: { shipping_charges: i.shippingCharges, cod_charges: i.codCharges, discount_amount: i.discount },
      ...(i.courierId ? { courier_id: i.courierId } : {}),
      label_format: "a4-4up",
    },
  });
  const b = data.booking;
  if (!b?.awb) throw new Error("Order was created in NimbusPost but no courier was booked. Try another courier.");
  return {
    providerOrderId: b.order_id ?? data.order?.order_id ?? "",
    awb: b.awb,
    courierId: b.courier_id ?? i.courierId ?? "",
    courierName: b.courier_name ?? "",
    status: b.order_status ?? "booked",
    labelUrl: b.label_url ?? null,
    trackingUrl: b.tracking_short_url ?? b.tracking_url ?? null,
    charged: typeof b.price?.total === "number" ? Math.round(b.price.total) : null,
    pickupGenerated: !!b.pickup_generated,
  };
}

export async function cancelShipment(awb: string, reason = "Cancelled by seller"): Promise<void> {
  await call("/shipments/cancel", { method: "POST", body: { awb, reason } });
}

export async function schedulePickup(providerOrderId: string): Promise<void> {
  await call("/shipments/pickup", { method: "POST", body: { order_id: providerOrderId } });
}

/** Fresh label link (label URLs expire). */
export async function getLabelUrl(providerOrderId: string): Promise<string | null> {
  const data = await call<{ url?: string }>("/shipments/labels", { method: "POST", body: { order_id: providerOrderId } });
  return data.url ?? null;
}

export type TrackingEvent = { status: string; location: string | null; message: string | null; at: string };

export async function trackShipment(awb: string): Promise<{ status: string; events: TrackingEvent[]; trackingUrl: string | null }> {
  const d = await call<{
    orderStatus?: string;
    latest?: { shipStatus?: string };
    scans?: { timestamp?: string; status?: string; status_code?: string; location?: string; remark?: string }[];
    tracking_short_url?: string;
    tracking_url?: string;
  }>(`/tracking/${encodeURIComponent(awb)}`);
  return {
    status: d.orderStatus ?? d.latest?.shipStatus ?? "",
    trackingUrl: d.tracking_short_url ?? d.tracking_url ?? null,
    events: (d.scans ?? []).map((s) => ({
      status: s.status ?? s.status_code ?? "",
      location: s.location ?? null,
      message: s.remark ?? s.status ?? null,
      at: s.timestamp ?? "",
    })),
  };
}
