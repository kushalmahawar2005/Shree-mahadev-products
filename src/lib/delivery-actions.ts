"use server";

import { z } from "zod";
import { checkoutConfig } from "@/config/checkout";
import { lookupPincodeAction } from "@/lib/checkout-actions";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { quoteShipping } from "@/lib/server/shipping";
import { parcelFor } from "@/lib/packaging";
import { getStoreSettings } from "@/lib/server/store-settings";

const Input = z
  .object({
    pincode: z.string().regex(/^[1-9]\d{5}$/),
    handle: z.string().regex(/^[a-z0-9-]{1,80}$/),
    sizeValue: z.number().int().positive().max(100000),
    sizeUnit: z.enum(["ml", "g"]),
    qty: z.number().int().min(1).max(200),
    subtotal: z.number().int().min(0).max(10_000_000),
  })
  .strict();

export type DeliveryCheck =
  | { ok: false; error: string }
  | {
      ok: true;
      serviceable: boolean;
      place: string;
      /** "Sat, 15 Nov" or null when the courier gives no estimate. */
      by: string | null;
      etaDays: string;
      freeShipping: boolean;
      shipping: number;
      cod: boolean;
    };

/** Product page "Check delivery": serviceability, ETA, shipping and COD for one pincode (no cart needed). */
export async function checkDeliveryAction(raw: unknown): Promise<DeliveryCheck> {
  const p = Input.safeParse(raw);
  if (!p.success) return { ok: false, error: "Enter a valid 6-digit pincode." };
  const limit = await rateLimit("delivery_check", await clientIp(), 30, 10);
  if (!limit.ok) return { ok: false, error: `Too many checks. Try again in ${limit.retryInMin} min.` };
  const { pincode, handle, sizeValue, sizeUnit, qty, subtotal } = p.data;
  const parcel = parcelFor([{ handle, sizeValue, sizeUnit, qty }]);
  const [place, quote, settings] = await Promise.all([
    lookupPincodeAction(pincode),
    quoteShipping({ pincode, subtotal, weightGrams: parcel.grams, dims: parcel.box, method: "payu" }).catch(() => null),
    getStoreSettings(),
  ]);
  if (!quote) return { ok: false, error: "Couldn't check right now. Please try again." };
  const days = quote.edd ? Number(/\d+/.exec(quote.edd)?.[0]) || null : null;
  const { min, max } = checkoutConfig.fallbackEtaDays;
  const date = new Date(Date.now() + ((days ?? max) + 1) * 86400000);
  return {
    ok: true,
    serviceable: quote.serviceable,
    place: [place?.city, pincode].filter(Boolean).join(" "),
    by: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(date),
    etaDays: days ? `${days + 1}–${days + 3} days` : `${min}–${max} days`,
    freeShipping: quote.shipping === 0,
    shipping: quote.shipping,
    cod: settings.shipping.codEnabled && quote.serviceable,
  };
}
