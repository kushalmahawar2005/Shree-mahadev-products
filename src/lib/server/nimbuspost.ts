import "server-only";

/**
 * NimbusPost API (https://api.nimbuspost.com/v1). Used for:
 *  - rate quotes by pincode (cheapest courier wins)
 *  - later: booking shipments + tracking
 * TODO(verify): response field names against a live account once credentials arrive.
 */
const API = "https://api.nimbuspost.com/v1";

export function nimbusConfigured() {
  return Boolean(process.env.NIMBUSPOST_EMAIL && process.env.NIMBUSPOST_PASSWORD);
}

const g = globalThis as unknown as { __nimbusToken?: { value: string; exp: number } };

async function token(): Promise<string> {
  if (g.__nimbusToken && g.__nimbusToken.exp > Date.now()) return g.__nimbusToken.value;
  const res = await fetch(`${API}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.NIMBUSPOST_EMAIL, password: process.env.NIMBUSPOST_PASSWORD }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json()) as { status?: boolean; data?: string; message?: string };
  if (!json.status || !json.data) throw new Error(`NimbusPost login failed: ${json.message ?? res.status}`);
  g.__nimbusToken = { value: json.data, exp: Date.now() + 60 * 60 * 1000 }; // refresh hourly
  return json.data;
}

export type CourierQuote = {
  courierId: string;
  courierName: string;
  freight: number; // ₹
  codCharge: number; // ₹
  total: number; // ₹
  edd?: string;
};

type RawCourier = {
  id?: string | number;
  name?: string;
  freight_charges?: number | string;
  cod_charges?: number | string;
  total_charges?: number | string;
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
  const res = await fetch(`${API}/courier/serviceability`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({
      origin: process.env.NIMBUSPOST_PICKUP_PINCODE ?? "305624",
      destination: input.destination,
      payment_type: input.paymentType,
      order_amount: String(input.orderAmount),
      weight: String(Math.max(input.weightGrams, 100)),
      length: String(dims.length),
      breadth: String(dims.breadth),
      height: String(dims.height),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json()) as { status?: boolean; data?: RawCourier[]; message?: string };
  if (!json.status || !Array.isArray(json.data)) return [];
  return json.data
    .map((c) => ({
      courierId: String(c.id ?? ""),
      courierName: c.name ?? "Courier",
      freight: Number(c.freight_charges ?? 0),
      codCharge: Number(c.cod_charges ?? 0),
      total: Number(c.total_charges ?? Number(c.freight_charges ?? 0) + Number(c.cod_charges ?? 0)),
      edd: c.edd,
    }))
    .filter((c) => c.courierId && Number.isFinite(c.total) && c.total > 0)
    .sort((a, b) => a.total - b.total);
}
