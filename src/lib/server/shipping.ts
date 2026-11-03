import "server-only";
import { site } from "@/data/site";
import { getCourierQuotes, nimbusConfigured } from "./nimbuspost";

export type ShippingQuote = {
  serviceable: boolean;
  shipping: number; // ₹ charged to customer (0 above free threshold)
  codFee: number; // ₹ extra for COD
  courierId: string | null;
  courierName: string | null;
  edd: string | null;
  source: "nimbuspost" | "flat";
};

/** Packed weight estimate until real weights are set per variant. TODO(client): real packed weights. */
export function estimateWeightGrams(sizeValue: number, sizeUnit: "ml" | "g", qty: number) {
  const content = sizeUnit === "ml" ? sizeValue * 0.92 : sizeValue; // oil ≈ 0.92 g/ml
  const pack = sizeValue >= 5000 ? 350 : sizeValue >= 1000 ? 150 : 90; // tin / bottle / jar + padding
  return Math.ceil((content + pack) * qty);
}

const cache = new Map<string, { at: number; q: ShippingQuote }>();
const TTL = 30 * 60 * 1000;

/**
 * Cheapest courier for this pincode. Shipping is free at/above the threshold;
 * the COD charge (if any) is still passed on for COD orders.
 */
export async function quoteShipping(input: {
  pincode: string;
  subtotal: number;
  weightGrams: number;
  method: "payu" | "cod";
}): Promise<ShippingQuote> {
  const free = input.subtotal >= site.freeShippingThreshold;
  const flat: ShippingQuote = {
    serviceable: true,
    shipping: free ? 0 : site.shippingFee,
    codFee: input.method === "cod" ? site.codFee : 0,
    courierId: null,
    courierName: null,
    edd: null,
    source: "flat",
  };
  if (!nimbusConfigured()) return flat;

  const key = `${input.pincode}|${input.method}|${Math.ceil(input.weightGrams / 500)}|${free}|${Math.ceil(input.subtotal / 500)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.q;

  try {
    const quotes = await getCourierQuotes({
      destination: input.pincode,
      weightGrams: input.weightGrams,
      paymentType: input.method === "cod" ? "cod" : "prepaid",
      orderAmount: input.subtotal,
    });
    const best = quotes[0];
    const q: ShippingQuote = best
      ? {
          serviceable: true,
          shipping: free ? 0 : Math.ceil(best.freight),
          codFee: input.method === "cod" ? Math.ceil(best.codCharge) : 0,
          courierId: best.courierId,
          courierName: best.courierName,
          edd: best.edd ?? null,
          source: "nimbuspost",
        }
      : { ...flat, serviceable: false, source: "nimbuspost" };
    cache.set(key, { at: Date.now(), q });
    return q;
  } catch (e) {
    console.error("NimbusPost quote failed, using flat rate", e);
    return flat;
  }
}
