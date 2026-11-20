import "server-only";

/**
 * Velocity Shipping custom API — https://www.velocity.in/shipping-faq/api
 * Auth: `Authorization: Bearer <API key>` (Dashboard → Settings → API Keys; the old username/password
 * token is deprecated for most endpoints). Rates: grams + cm in, rupees out.
 *
 * Env: VELOCITY_API_KEY, VELOCITY_WAREHOUSE_ID (Settings → Warehouses, e.g. "WH…"),
 * VELOCITY_PICKUP_LOCATION (warehouse name as in the dashboard), pickup pincode shared with NimbusPost.
 */
const API = "https://shazam.velocity.in/custom/api/v1";

export function velocityConfigured() {
  return Boolean(process.env.VELOCITY_API_KEY && process.env.VELOCITY_WAREHOUSE_ID);
}

const pickupPincode = () => process.env.VELOCITY_PICKUP_PINCODE ?? process.env.NIMBUSPOST_PICKUP_PINCODE ?? "305624";

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!velocityConfigured()) throw new Error("Velocity is not configured");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VELOCITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    status?: string | number;
    message?: string;
    error?: string | { message?: string };
    meta?: { message?: string; details?: string };
  };
  const failed = !res.ok || json.status === "FAILURE" || json.status === 0 || json.status === "0";
  if (failed) {
    const err = typeof json.error === "string" ? json.error : json.error?.message;
    throw new Error(`Velocity: ${err || json.meta?.details || json.meta?.message || json.message || `HTTP ${res.status}`}`);
  }
  return json as T;
}

// ───────────── Rates ─────────────

export type VelocityQuote = {
  carrierId: string;
  carrierName: string;
  freight: number;
  codCharge: number;
  total: number; // freight + COD + platform fee (₹, before GST)
  edd?: string;
};

type RateCourier = {
  carrier_id?: string;
  carrier_name?: string;
  status?: string;
  expected_delivery?: { pickup?: string; delivery?: string };
  charges?: { forward_freight_charges?: number; cod_charges?: number; total_forward_charges?: number };
  platform_fee?: number;
};

/** Every active courier for the lane with its price, cheapest first. Empty = not serviceable. */
export async function getVelocityQuotes(input: {
  destination: string;
  weightGrams: number;
  paymentType: "cod" | "prepaid";
  orderAmount: number;
  dims: { length: number; breadth: number; height: number };
}): Promise<VelocityQuote[]> {
  const data = await call<{ result?: { serviceable_couriers?: RateCourier[] } }>("/rates", {
    journey_type: "forward",
    origin_pincode: pickupPincode(),
    destination_pincode: input.destination,
    dead_weight: Math.max(Math.round(input.weightGrams), 50),
    length: input.dims.length,
    width: input.dims.breadth,
    height: input.dims.height,
    payment_method: input.paymentType,
    ...(input.paymentType === "cod" ? { shipment_value: input.orderAmount } : {}),
  });
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return (data.result?.serviceable_couriers ?? [])
    .filter((c) => c.carrier_id && (!c.status || c.status === "active"))
    .map((c) => {
      const freight = n(c.charges?.forward_freight_charges);
      const codCharge = n(c.charges?.cod_charges);
      const total = Math.round((n(c.charges?.total_forward_charges) || freight + codCharge) * 100 + n(c.platform_fee) * 100) / 100;
      return {
        carrierId: String(c.carrier_id),
        carrierName: String(c.carrier_name ?? "Velocity courier"),
        freight,
        codCharge,
        total,
        edd: c.expected_delivery?.delivery ? `by ${c.expected_delivery.delivery}` : undefined,
      };
    })
    .filter((q) => q.total > 0)
    .sort((a, b) => a.total - b.total);
}

// ───────────── Shipments ─────────────

export type VelocityShipmentInput = {
  orderNumber: string;
  orderDate: Date;
  paymentType: "cod" | "prepaid";
  orderAmount: number;
  weightGrams: number;
  dims: { length: number; breadth: number; height: number };
  carrierId?: string;
  consignee: { name: string; email?: string; address: string; address_2?: string; city: string; state: string; pincode: string; phone: string };
  items: { name: string; qty: number; price: number; sku?: string }[];
};

export type VelocityBooked = {
  shipmentId: string;
  awb: string;
  courierName: string;
  labelUrl: string | null;
  charged: number | null;
  pickupGenerated: boolean;
};

type Booking = {
  status?: number;
  payload?: {
    shipment_id?: string;
    awb_code?: string;
    courier_name?: string;
    label_url?: string | null;
    pickup_generated?: number;
    charges?: { frwd_charges?: { shipping_charges?: string; cod_charges?: string } };
  };
};

const ymdHm = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour") === "24" ? "00" : v("hour")}:${v("minute")}`;
};

/** Create the order at Velocity and assign the courier (AWB + label + pickup) in one call. */
export async function createVelocityShipment(i: VelocityShipmentInput): Promise<VelocityBooked> {
  const c = i.consignee;
  const [first, ...rest] = c.name.trim().split(/\s+/);
  const data = await call<Booking>("/forward-order-orchestration", {
    order_id: i.orderNumber,
    order_date: ymdHm(i.orderDate),
    ...(i.carrierId ? { carrier_id: i.carrierId } : {}),
    billing_customer_name: first || c.name,
    billing_last_name: rest.join(" "),
    billing_address: [c.address, c.address_2].filter(Boolean).join(", ").slice(0, 250),
    billing_city: c.city,
    billing_pincode: c.pincode,
    billing_state: c.state,
    billing_country: "India",
    ...(c.email ? { billing_email: c.email } : {}),
    billing_phone: c.phone,
    shipping_is_billing: true,
    print_label: true,
    order_items: i.items.map((x) => ({ name: x.name.slice(0, 200), sku: x.sku || x.name.slice(0, 40), units: x.qty, selling_price: x.price, discount: 0, tax: 0 })),
    payment_method: i.paymentType === "cod" ? "COD" : "PREPAID",
    sub_total: i.orderAmount,
    cod_collectible: i.paymentType === "cod" ? i.orderAmount : 0,
    length: i.dims.length,
    breadth: i.dims.breadth,
    height: i.dims.height,
    // Velocity wants kg here (rates take grams).
    weight: Math.max(Math.round(i.weightGrams), 50) / 1000,
    pickup_location: process.env.VELOCITY_PICKUP_LOCATION ?? "Mahadev Products Warehouse",
    warehouse_id: process.env.VELOCITY_WAREHOUSE_ID,
  });
  const p = data.payload;
  if (!p?.awb_code) throw new Error("Velocity created the order but no courier was assigned. Try another courier.");
  const ch = p.charges?.frwd_charges;
  const charged = ch ? Math.round((Number(ch.shipping_charges ?? 0) + Number(ch.cod_charges ?? 0)) * 100) / 100 : null;
  return {
    shipmentId: p.shipment_id ?? "",
    awb: p.awb_code,
    courierName: p.courier_name ?? "",
    labelUrl: p.label_url ?? null,
    charged,
    pickupGenerated: p.pickup_generated === 1,
  };
}

export async function cancelVelocityShipment(awb: string): Promise<void> {
  await call("/cancel-order", { awbs: [awb] });
}

export type VelocityTracking = {
  status: string;
  trackingUrl: string | null;
  events: { status: string; location: string | null; message: string | null; at: string }[];
};

export async function trackVelocityShipment(awb: string): Promise<VelocityTracking> {
  const data = await call<{
    result?: Record<string, { tracking_data?: { shipment_status?: string; track_url?: string; shipment_track_activities?: { date?: string; activity?: string; location?: string }[] } }>;
  }>("/order-tracking", { awbs: [awb] });
  const t = data.result?.[awb]?.tracking_data;
  return {
    status: t?.shipment_status ?? "",
    trackingUrl: t?.track_url ?? null,
    events: (t?.shipment_track_activities ?? []).map((a) => ({
      status: a.activity ?? "",
      location: a.location ?? null,
      message: a.activity ?? null,
      at: a.date ? `${a.date.replace(" ", "T")}+05:30` : "",
    })),
  };
}
