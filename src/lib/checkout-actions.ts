"use server";

import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { getProduct } from "@/lib/commerce";
import { getCartAction } from "@/lib/commerce/actions";
import { INDIAN_STATES } from "@/lib/checkout";
import { captureCartContact } from "@/lib/server/carts";
import { clearCartCookies, getCartDbToken } from "@/lib/server/cart-cookies";
import { createOrder, type OrderItemInput } from "@/lib/server/orders";
import { OutOfStockError } from "@/lib/server/inventory";
import { notifyOrder } from "@/lib/server/mail";
import { estimateWeightGrams, quoteShipping } from "@/lib/server/shipping";

export type CheckoutState = { error?: string; fieldErrors?: Partial<Record<string, string>> } | undefined;

export type ShippingQuoteResult =
  | { ok: true; serviceable: boolean; payu: { shipping: number }; cod: { shipping: number; codFee: number }; edd: string | null }
  | { ok: false };

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
    const packed = (v as { weightGrams?: number | null }).weightGrams;
    weight += packed ? packed * l.quantity : estimateWeightGrams(v.sizeValue, v.sizeUnit, l.quantity);
  }
  return { items, weight, subtotal: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) } as const;
}

/** Called when the shopper finishes typing a pincode: cheapest courier for prepaid and COD. */
export async function quoteShippingAction(pincode: string): Promise<ShippingQuoteResult> {
  if (!z.string().regex(PIN).safeParse(pincode).success) return { ok: false };
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
const Contact = z.object({ name: z.string().max(200), phone: z.string().max(20), email: z.string().max(200), pincode: z.string().max(10) }).partial().strict();

export async function saveCheckoutContactAction(raw: { name?: string; phone?: string; email?: string; pincode?: string }) {
  const p = Contact.safeParse(raw);
  if (!p.success) return;
  const input = p.data;
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

const CheckoutForm = z.object({
  method: z.enum(["payu", "cod"]).catch("payu"),
  name: z.string().trim().min(2, "Please enter your full name.").max(120),
  phone: z
    .string()
    .transform(cleanPhone)
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number.")),
  // Email is optional (order updates only); if given it must be valid.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine((e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), "Enter a valid email or leave it empty."),
  line1: z.string().trim().min(5, "Enter house no. and street.").max(255),
  line2: z.string().trim().max(255).transform((v) => v || undefined),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  state: z.string().refine((v) => (INDIAN_STATES as readonly string[]).includes(v), "Select your state."),
  pincode: z.string().trim().regex(PIN, "Enter a 6-digit pincode."),
});

export async function placeOrderAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const limit = await rateLimit("checkout", await clientIp(), 10, 10);
  if (!limit.ok) return { error: `Too many attempts. Please try again in ${limit.retryInMin} min or order on WhatsApp.` };

  const field = (k: string) => String(fd.get(k) ?? "");
  const parsed = CheckoutForm.safeParse(Object.fromEntries(["method", "name", "phone", "email", "line1", "line2", "city", "state", "pincode"].map((k) => [k, field(k)])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const { method, ...address } = parsed.data;
  if (method === "cod" && !site.codAvailable) return { fieldErrors: { method: "Cash on delivery is not available." } };

  const c = await pricedCart();
  if ("error" in c) return { error: c.error };

  // Re-quote on the server: the price shown in the browser is never trusted.
  const q = await quoteShipping({ pincode: address.pincode, subtotal: c.subtotal, weightGrams: c.weight, method });
  if (!q.serviceable) {
    return { fieldErrors: { pincode: method === "cod" ? "COD isn't available for this pincode. Please pay online." : "We can't deliver to this pincode yet." } };
  }

  let token: string;
  let orderId: number;
  try {
    ({ token, id: orderId } = await createOrder({
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
    if (e instanceof OutOfStockError) return { error: e.message };
    console.error("createOrder failed", e);
    return { error: "We couldn't place your order. Please try again or order on WhatsApp." };
  }

  if (method === "cod") {
    await notifyOrder(orderId, "order_placed");
    await clearCartCookies();
    redirect(`/order?t=${token}`);
  }
  redirect(`/checkout/pay?t=${token}`);
}
