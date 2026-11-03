"use server";

import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { getProduct } from "@/lib/commerce";
import { getCartAction } from "@/lib/commerce/actions";
import { INDIAN_STATES } from "@/lib/checkout";
import { captureCartContact } from "@/lib/server/carts";
import { clearCartCookies, getCartDbToken } from "@/lib/server/cart-cookies";
import { createOrder, type OrderItemInput, type PaymentMethod } from "@/lib/server/orders";
import { estimateWeightGrams, quoteShipping } from "@/lib/server/shipping";

export type CheckoutState = { error?: string; fieldErrors?: Partial<Record<string, string>> } | undefined;

export type ShippingQuoteResult =
  | { ok: true; serviceable: boolean; payu: { shipping: number }; cod: { shipping: number; codFee: number }; edd: string | null }
  | { ok: false };

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const cleanPhone = (p: string) => p.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
const PIN = /^[1-9]\d{5}$/;

/** Server-priced lines + packed weight. Prices never come from the browser. */
async function pricedCart() {
  const cart = await getCartAction();
  if (!cart?.lines.length) return { error: "Your cart is empty." } as const;
  const items: OrderItemInput[] = [];
  let weight = 0;
  for (const l of cart.lines) {
    const product = await getProduct(l.product.handle);
    const v = product?.variants.find((x) => x.id === l.variant.id);
    if (!product || !v?.availableForSale || v.price.amount <= 0) {
      return { error: `${l.product.title} (${l.variant.title}) is not available right now. Please remove it.` } as const;
    }
    items.push({
      variantKey: v.id,
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: v.title,
      sku: v.sku,
      unitPrice: v.price.amount,
      compareAtPrice: v.compareAtPrice?.amount,
      quantity: l.quantity,
    });
    weight += estimateWeightGrams(v.sizeValue, v.sizeUnit, l.quantity);
  }
  return { items, weight, subtotal: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) } as const;
}

/** Called when the shopper finishes typing a pincode: cheapest courier for prepaid and COD. */
export async function quoteShippingAction(pincode: string): Promise<ShippingQuoteResult> {
  if (typeof pincode !== "string" || !PIN.test(pincode)) return { ok: false };
  const c = await pricedCart();
  if ("error" in c) return { ok: false };
  const base = { pincode, subtotal: c.subtotal, weightGrams: c.weight };
  const [payu, cod] = await Promise.all([
    quoteShipping({ ...base, method: "payu" }),
    site.codAvailable ? quoteShipping({ ...base, method: "cod" }) : null,
  ]);
  return {
    ok: true,
    serviceable: payu.serviceable,
    payu: { shipping: payu.shipping },
    cod: cod?.serviceable ? { shipping: cod.shipping, codFee: cod.codFee } : { shipping: -1, codFee: 0 },
    edd: payu.edd,
  };
}

/** Saves contact details as they are typed, so abandoned checkouts can be followed up. */
export async function saveCheckoutContactAction(input: { name?: string; phone?: string; email?: string; pincode?: string }) {
  const token = await getCartDbToken();
  if (!token) return;
  const phone = cleanPhone(String(input.phone ?? ""));
  const email = String(input.email ?? "").trim().toLowerCase();
  try {
    await captureCartContact(token, {
      name: String(input.name ?? "").trim().slice(0, 120) || undefined,
      phone: /^[6-9]\d{9}$/.test(phone) ? phone : undefined,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 160) : undefined,
      pincode: PIN.test(String(input.pincode ?? "")) ? String(input.pincode) : undefined,
    });
  } catch (e) {
    console.error("captureCartContact failed", e);
  }
}

export async function placeOrderAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const method = (s(fd, "method") === "cod" ? "cod" : "payu") as PaymentMethod;
  const address = {
    name: s(fd, "name").slice(0, 120),
    phone: cleanPhone(s(fd, "phone")),
    email: s(fd, "email").toLowerCase().slice(0, 160),
    line1: s(fd, "line1").slice(0, 255),
    line2: s(fd, "line2").slice(0, 255) || undefined,
    city: s(fd, "city").slice(0, 80),
    state: s(fd, "state"),
    pincode: s(fd, "pincode"),
  };

  const fieldErrors: Record<string, string> = {};
  if (address.name.length < 2) fieldErrors.name = "Please enter your full name.";
  if (!/^[6-9]\d{9}$/.test(address.phone)) fieldErrors.phone = "Enter a 10-digit mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) fieldErrors.email = "Enter a valid email.";
  if (address.line1.length < 5) fieldErrors.line1 = "Enter house no. and street.";
  if (address.city.length < 2) fieldErrors.city = "Enter your city.";
  if (!(INDIAN_STATES as readonly string[]).includes(address.state)) fieldErrors.state = "Select your state.";
  if (!PIN.test(address.pincode)) fieldErrors.pincode = "Enter a 6-digit pincode.";
  if (method === "cod" && !site.codAvailable) fieldErrors.method = "Cash on delivery is not available.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const c = await pricedCart();
  if ("error" in c) return { error: c.error };

  // Re-quote on the server: the price shown in the browser is never trusted.
  const q = await quoteShipping({ pincode: address.pincode, subtotal: c.subtotal, weightGrams: c.weight, method });
  if (!q.serviceable) {
    return { fieldErrors: { pincode: method === "cod" ? "COD isn't available for this pincode. Please pay online." : "We can't deliver to this pincode yet." } };
  }

  let token: string;
  try {
    ({ token } = await createOrder({
      method,
      address,
      items: c.items,
      subtotal: c.subtotal,
      shipping: q.shipping,
      codFee: q.codFee,
      courierId: q.courierId,
      courierName: q.courierName,
      cartToken: await getCartDbToken(),
    }));
  } catch (e) {
    console.error("createOrder failed", e);
    return { error: "We couldn't place your order. Please try again or order on WhatsApp." };
  }

  if (method === "cod") {
    await clearCartCookies();
    redirect(`/order?t=${token}`);
  }
  redirect(`/checkout/pay?t=${token}`);
}
