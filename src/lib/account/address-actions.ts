"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addressSchema } from "@/components/account/addresses/schema";
import { checkoutConfig } from "@/config/checkout";
import { lookupPincodeAction } from "@/lib/checkout-actions";
import {
  AddressError,
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "@/lib/server/account-addresses";
import { requireCustomer } from "@/lib/server/customer-auth";
import { quoteShipping } from "@/lib/server/shipping";

type Result = { ok: true } | { ok: false; error: string };

const Id = z.number().int().positive();
const PIN = /^[1-9]\d{5}$/;

function fail(e: unknown): Result {
  if (e instanceof AddressError) return { ok: false, error: e.message };
  console.error("Address action failed", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const refresh = () => revalidatePath("/account", "layout");

export async function saveAddressAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = z
    .object({ id: Id.optional(), address: addressSchema })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the address.",
    };
  const { id, address } = parsed.data;
  const input = { ...address, line2: null };
  try {
    if (id) await updateAddress(customer.id, id, input);
    else await createAddress(customer.id, input);
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true };
}

export async function setDefaultAddressAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = Id.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid address." };
  try {
    await setDefaultAddress(customer.id, parsed.data);
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true };
}

export async function deleteAddressAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = Id.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid address." };
  try {
    await deleteAddress(customer.id, parsed.data);
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true };
}

export type PincodeCheck =
  | {
      ok: true;
      city: string;
      state: string;
      serviceable: boolean;
      /** "3–5 days" style range. */
      eta: string;
    }
  | { ok: false };

/**
 * Pincode → city/state (same lookup as checkout) + courier serviceability. Checkout quotes the
 * live cart; the address book has no cart, so it asks for a typical 1 kg parcel instead.
 */
export async function checkAddressPincodeAction(
  raw: unknown,
): Promise<PincodeCheck> {
  await requireCustomer();
  const pin = z.string().regex(PIN).safeParse(raw);
  if (!pin.success) return { ok: false };
  const [place, quote] = await Promise.all([
    lookupPincodeAction(pin.data),
    quoteShipping({
      pincode: pin.data,
      subtotal: 0,
      weightGrams: 1000,
      method: "payu",
    }).catch(() => null),
  ]);
  if (!quote) return { ok: false };
  const days = quote.edd ? Number(/\d+/.exec(quote.edd)?.[0]) || null : null;
  const { min, max } = checkoutConfig.fallbackEtaDays;
  return {
    ok: true,
    city: place?.city ?? "",
    state: place?.state ?? "",
    serviceable: quote.serviceable,
    eta: days ? `${days + 1}–${days + 3} days` : `${min}–${max} days`,
  };
}
