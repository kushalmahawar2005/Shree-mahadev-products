import "server-only";
import { getStoreSettings } from "./store-settings";
import { getCourierQuotes, nimbusConfigured } from "./nimbuspost";
import { boxForWeight, packedWeightGrams, type Box } from "@/lib/packaging";

export type ShippingQuote = {
  serviceable: boolean;
  shipping: number; // ₹ charged to customer (0 above free threshold)
  codFee: number; // ₹ extra for COD
  courierId: string | null;
  courierName: string | null;
  edd: string | null;
  source: "nimbuspost" | "flat";
};

/** Shipping weight for `qty` units, from the client's packaging sheet (see lib/packaging.ts). */
export function estimateWeightGrams(handle: string, sizeValue: number, sizeUnit: "ml" | "g", qty: number) {
  return packedWeightGrams(handle, sizeValue, sizeUnit, qty);
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
  /** Parcel box from lib/packaging (parcelFor); falls back to a box matching the weight. */
  dims?: Box;
}): Promise<ShippingQuote> {
  const { shipping: cfg } = await getStoreSettings();
  const free = input.subtotal >= cfg.freeShippingThreshold;
  const flat: ShippingQuote = {
    serviceable: true,
    shipping: free ? 0 : cfg.flatShippingFee,
    codFee: input.method === "cod" ? cfg.flatCodFee : 0,
    courierId: null,
    courierName: null,
    edd: null,
    source: "flat",
  };
  if (!nimbusConfigured()) return flat;

  const dims = input.dims ?? boxForWeight(input.weightGrams);
  const key = `${input.pincode}|${input.method}|${Math.ceil(input.weightGrams / 500)}|${dims.length}x${dims.breadth}x${dims.height}|${free}|${Math.ceil(input.subtotal / 500)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.q;

  try {
    const quotes = await getCourierQuotes({
      destination: input.pincode,
      weightGrams: input.weightGrams,
      paymentType: input.method === "cod" ? "cod" : "prepaid",
      orderAmount: input.subtotal,
      dims,
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
    // We can't confirm the courier delivers COD to this pincode: allow prepaid at the flat rate,
    // refuse COD until a real quote works (better than accepting a COD order we can't ship).
    if (input.method === "cod") return { ...flat, serviceable: false };
    return flat;
  }
}
