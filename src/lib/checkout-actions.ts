"use server";

import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

import { redirect } from "next/navigation";
import { getProduct } from "@/lib/commerce";
import { getCartAction } from "@/lib/commerce/actions";
import { INDIAN_STATES } from "@/lib/checkout";
import { stateFromPincode } from "@/lib/pincode-states";
import { checkoutConfig } from "@/config/checkout";
import { captureCartContact } from "@/lib/server/carts";
import { clearCartCookies, getCartDbToken } from "@/lib/server/cart-cookies";
import { createOrder, type OrderItemInput } from "@/lib/server/orders";
import { OutOfStockError } from "@/lib/server/inventory";
import { notifyOrder } from "@/lib/server/mail";
import { queueOrderWhatsApp } from "@/lib/server/whatsapp";
import { estimateWeightGrams, quoteShipping } from "@/lib/server/shipping";
import { getStoreSettings } from "@/lib/server/store-settings";
import { calculateCoupon, CouponError } from "@/lib/server/coupons";
import { headers } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { listAddresses, type SavedAddress } from "@/lib/server/account-addresses";

export type CheckoutState =
  | { error?: string; fieldErrors?: Partial<Record<string, string>>; payUrl?: string }
  | undefined;

export type ShippingQuoteResult =
  | {
      ok: true;
      serviceable: boolean;
      payu: { shipping: number };
      cod: { shipping: number; codFee: number };
      edd: string | null;
      /** Courier's minimum transit days (null = unknown, e.g. flat-rate fallback). */
      etaDays: number | null;
    }
  | { ok: false };

const cleanPhone = (p: string) =>
  p.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
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
      return {
        error: `${l.product.title} (${l.variant.title}) is not available right now. Please remove it.`,
      } as const;
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
    weight += packed
      ? packed * l.quantity
      : estimateWeightGrams(v.sizeValue, v.sizeUnit, l.quantity);
  }
  return {
    items,
    weight,
    subtotal: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
  } as const;
}

/** Called when the shopper finishes typing a pincode: cheapest courier for prepaid and COD. */
export async function quoteShippingAction(
  pincode: string,
): Promise<ShippingQuoteResult> {
  if (!z.string().regex(PIN).safeParse(pincode).success) return { ok: false };
  const c = await pricedCart();
  if ("error" in c) return { ok: false };
  const base = { pincode, subtotal: c.subtotal, weightGrams: c.weight };
  const [payu, cod] = await Promise.all([
    quoteShipping({ ...base, method: "payu" }),
    (await getStoreSettings()).shipping.codEnabled
      ? quoteShipping({ ...base, method: "cod" })
      : null,
  ]);
  return {
    ok: true,
    serviceable: payu.serviceable,
    payu: { shipping: payu.shipping },
    cod: cod?.serviceable
      ? { shipping: cod.shipping, codFee: cod.codFee }
      : { shipping: -1, codFee: 0 },
    edd: payu.edd,
    etaDays: payu.edd ? Number(/\d+/.exec(payu.edd)?.[0]) || null : null,
  };
}

const pinCache = new Map<string, { city: string; state: string }>();

/** Pincode → city + state for autofill. Public India Post API, with an offline prefix table fallback. */
export async function lookupPincodeAction(
  pincode: string,
): Promise<{ city: string; state: string } | null> {
  if (!PIN.test(pincode)) return null;
  const hit = pinCache.get(pincode);
  if (hit) return hit;
  let result: { city: string; state: string } | null = null;
  try {
    const res = await fetch(`${checkoutConfig.pincodeLookupUrl}${pincode}`, {
      signal: AbortSignal.timeout(3500),
    });
    const data = (await res.json()) as {
      Status?: string;
      PostOffice?: { District?: string; State?: string }[] | null;
    }[];
    const po = data?.[0]?.Status === "Success" ? data[0].PostOffice?.[0] : undefined;
    const state = (INDIAN_STATES as readonly string[]).find(
      (s) => s.toLowerCase() === po?.State?.trim().toLowerCase(),
    );
    if (po?.District) result = { city: po.District.trim(), state: state ?? stateFromPincode(pincode) ?? "" };
  } catch {
    // network/API down: fall back below
  }
  result ??= stateFromPincode(pincode) ? { city: "", state: stateFromPincode(pincode)! } : null;
  if (result?.city) pinCache.set(pincode, result);
  return result;
}

/** Saves contact details as they are typed, so abandoned checkouts can be followed up. */
const Contact = z
  .object({
    name: z.string().max(200),
    phone: z.string().max(20),
    email: z.string().max(200),
    pincode: z.string().max(10),
  })
  .partial()
  .strict();

export async function saveCheckoutContactAction(raw: {
  name?: string;
  phone?: string;
  email?: string;
  pincode?: string;
}) {
  const p = Contact.safeParse(raw);
  if (!p.success) return;
  const input = p.data;
  const token = await getCartDbToken();
  if (!token) return;
  const phone = cleanPhone(String(input.phone ?? ""));
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  try {
    await captureCartContact(token, {
      name:
        String(input.name ?? "")
          .trim()
          .slice(0, 120) || undefined,
      phone: /^[6-9]\d{9}$/.test(phone) ? phone : undefined,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? email.slice(0, 160)
        : undefined,
      pincode: PIN.test(String(input.pincode ?? ""))
        ? String(input.pincode)
        : undefined,
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
    .refine(
      (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
      "Enter a valid email or leave it empty.",
    ),
  line1: z.string().trim().min(5, "Enter house no. and street.").max(255),
  line2: z
    .string()
    .trim()
    .max(255)
    .transform((v) => v || undefined),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  state: z
    .string()
    .refine(
      (v) => (INDIAN_STATES as readonly string[]).includes(v),
      "Select your state.",
    ),
  pincode: z.string().trim().regex(PIN, "Enter a 6-digit pincode."),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN or leave it empty.")
    .catch(""),
  couponCode: z.string().trim().max(30).catch(""),
});

type PlaceResult =
  | { error?: string; fieldErrors?: Partial<Record<string, string>> }
  | { placed: { method: "cod" | "payu"; token: string; orderId: number } };

export async function placeOrderAction(
  _prev: CheckoutState,
  fd: FormData,
): Promise<CheckoutState> {
  const limit = await rateLimit("checkout", await clientIp(), 10, 10);
  if (!limit.ok)
    return {
      error: `Too many attempts. Please try again in ${limit.retryInMin} min or order on WhatsApp.`,
    };
  const result = await placeOrderCore(fd, "web");
  if (!("placed" in result)) return result;
  if (result.placed.method === "cod") redirect(`/order?t=${result.placed.token}`);
  // The pay page auto-posts a form to PayU. A soft (router) navigation there races the
  // Next router's own history update and cancels that POST, so the client does a full load.
  return { payUrl: `/checkout/pay?t=${result.placed.token}` };
}

/**
 * Shared by the checkout page and the chat assistant, so both price, validate and create
 * orders the same way. Prices, shipping and COD rules are always computed here.
 */
async function placeOrderCore(fd: FormData, source: "web" | "chat"): Promise<PlaceResult> {
  const field = (k: string) => String(fd.get(k) ?? "");
  const parsed = CheckoutForm.safeParse(
    Object.fromEntries(
      [
        "method",
        "name",
        "phone",
        "email",
        "line1",
        "line2",
        "city",
        "state",
        "pincode",
        "gstin",
        "couponCode",
      ].map((k) => [k, field(k)]),
    ),
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues)
      fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const { method, couponCode: rawCoupon, gstin, ...address } = parsed.data;
  const { shipping: ship } = await getStoreSettings();
  if (method === "cod" && !ship.codEnabled)
    return {
      fieldErrors: { method: "Cash on delivery is not available right now." },
    };

  const c = await pricedCart();
  if ("error" in c) return { error: c.error };
  const couponCode = rawCoupon.trim().toUpperCase();
  let discount = 0;
  let freeShipping = false;
  if (couponCode) {
    const couponLimit = await rateLimit("coupon", await clientIp(), 15, 10);
    if (!couponLimit.ok)
      return {
        error: `Too many coupon attempts. Try again in ${couponLimit.retryInMin} min.`,
      };
    try {
      const quote = await calculateCoupon(
        couponCode,
        c.subtotal,
        address.phone,
        c.items.map((item) => ({
          productHandle: item.productHandle,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      );
      discount = quote.discount;
      freeShipping = quote.freeShipping;
    } catch (error) {
      return {
        error:
          error instanceof CouponError
            ? error.message
            : "This coupon can't be applied.",
      };
    }
  }
  const discountedSubtotal = c.subtotal - discount;
  if (
    method === "cod" &&
    ship.codMaxOrder &&
    discountedSubtotal > ship.codMaxOrder
  ) {
    return {
      fieldErrors: {
        method: `Cash on delivery is available up to ₹${ship.codMaxOrder}. Please pay online.`,
      },
    };
  }

  // Re-quote on the server: the price shown in the browser is never trusted.
  const q = await quoteShipping({
    pincode: address.pincode,
    subtotal: discountedSubtotal,
    weightGrams: c.weight,
    method,
  });
  if (!q.serviceable) {
    return {
      fieldErrors: {
        pincode:
          method === "cod"
            ? "COD isn't available for this pincode. Please pay online."
            : "We can't deliver to this pincode yet.",
      },
    };
  }

  let token: string;
  let orderId: number;
  try {
    const requestHeaders = await headers();
    ({ token, id: orderId } = await createOrder({
      method,
      address,
      items: c.items,
      subtotal: c.subtotal,
      shipping: freeShipping ? 0 : q.shipping,
      codFee: q.codFee,
      courierId: q.courierId,
      courierName: q.courierName,
      couponCode: couponCode || undefined,
      cartToken: await getCartDbToken(),
      clientIp: await clientIp(),
      userAgent: requestHeaders.get("user-agent"),
      customerGstin: gstin || null,
      source,
    }));
  } catch (e) {
    if (e instanceof OutOfStockError) return { error: e.message };
    if (e instanceof CouponError) return { error: e.message };
    console.error("createOrder failed", e);
    return {
      error:
        "We couldn't place your order. Please try again or order on WhatsApp.",
    };
  }

  if (method === "cod") {
    await notifyOrder(orderId, "order_placed");
    await queueOrderWhatsApp(orderId, "cod_confirmation").catch((error) => console.error("WhatsApp order notification", error));
    await clearCartCookies();
  }
  return { placed: { method, token, orderId } };
}

/* ------------------------------------------------------------------ */
/* Chat assistant checkout: same pricing and validation as the page.  */
/* ------------------------------------------------------------------ */

export type ChatAddress = { id: number; name: string; line1: string; city: string; state: string; pincode: string; phoneMasked: string; isDefault: boolean };
export type ChatCheckoutSummary =
  | { ok: false; auth: false }
  | { ok: false; auth: true; error: string; empty?: boolean }
  | {
      ok: true;
      auth: true;
      items: { title: string; variant: string; qty: number; lineTotal: number }[];
      itemCount: number;
      subtotal: number;
      addresses: ChatAddress[];
      addressId: number | null;
      quote: null | {
        serviceable: boolean;
        edd: string | null;
        payu: { shipping: number; total: number };
        cod: { allowed: boolean; reason?: string; shipping: number; codFee: number; total: number };
      };
    };

const maskPhone = (phone: string) => `${phone.slice(0, 2)}xxxxxx${phone.slice(-2)}`;
const toChatAddress = (a: SavedAddress): ChatAddress => ({ id: a.id, name: a.name, line1: a.line1, city: a.city, state: a.state, pincode: a.pincode, phoneMasked: maskPhone(a.phone), isDefault: a.isDefault });

/** Cart, saved addresses and server-computed totals for the chat checkout card. */
export async function chatCheckoutAction(raw: unknown): Promise<ChatCheckoutSummary> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, auth: false };
  const parsed = z.object({ addressId: z.number().int().positive().nullable().optional() }).strict().safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, auth: true, error: "Invalid request." };

  const c = await pricedCart();
  if ("error" in c) return { ok: false, auth: true, error: c.error ?? "Your cart is empty.", empty: c.error === "Your cart is empty." };
  const addresses = await listAddresses(session.id);
  const chosen = addresses.find((a) => a.id === parsed.data.addressId) ?? addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

  let quote: Extract<ChatCheckoutSummary, { ok: true }>["quote"] = null;
  if (chosen) {
    const ship = (await getStoreSettings()).shipping;
    const base = { pincode: chosen.pincode, subtotal: c.subtotal, weightGrams: c.weight };
    const [payu, cod] = await Promise.all([
      quoteShipping({ ...base, method: "payu" }),
      ship.codEnabled ? quoteShipping({ ...base, method: "cod" }) : null,
    ]);
    const codReason = !ship.codEnabled
      ? "Cash on delivery abhi band hai."
      : !cod?.serviceable
        ? "Is pincode par COD available nahi hai."
        : ship.codMaxOrder && c.subtotal > ship.codMaxOrder
          ? `COD ₹${ship.codMaxOrder} tak ke order par hi milta hai.`
          : undefined;
    quote = {
      serviceable: payu.serviceable,
      edd: payu.edd,
      payu: { shipping: payu.shipping, total: c.subtotal + payu.shipping },
      cod: { allowed: !codReason, reason: codReason, shipping: cod?.shipping ?? 0, codFee: cod?.codFee ?? 0, total: c.subtotal + (cod?.shipping ?? 0) + (cod?.codFee ?? 0) },
    };
  }
  return {
    ok: true,
    auth: true,
    items: c.items.map((item) => ({ title: item.productTitle, variant: item.variantTitle, qty: item.quantity, lineTotal: item.unitPrice * item.quantity })),
    itemCount: c.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: c.subtotal,
    addresses: addresses.map(toChatAddress),
    addressId: chosen?.id ?? null,
    quote,
  };
}

/** One result per idempotency key (10 min), so a double tap never creates two orders. */
const placed = new Map<string, { at: number; result: Promise<ChatPlaceResult> }>();
export type ChatPlaceResult =
  | { ok: true; method: "cod"; orderId: number; orderNo: string }
  | { ok: true; method: "payu"; orderId: number; orderNo: string; payUrl: string }
  | { ok: false; auth?: false; changed?: boolean; error: string };

/**
 * Places the order from the chat checkout card. Only an explicit button press calls this.
 * Re-prices on the server and refuses if the total moved since the card was shown.
 */
export async function placeChatOrderAction(raw: unknown): Promise<ChatPlaceResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, auth: false, error: "Please log in again." };
  const parsed = z
    .object({ addressId: z.number().int().positive(), method: z.enum(["cod", "payu"]), idempotencyKey: z.string().regex(/^[\w-]{12,64}$/), expectedTotal: z.number().nonnegative() })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const key = `${session.id}:${parsed.data.idempotencyKey}`;
  for (const [k, v] of placed) if (Date.now() - v.at > 10 * 60_000) placed.delete(k);
  const existing = placed.get(key);
  if (existing) return existing.result;

  const run = (async (): Promise<ChatPlaceResult> => {
    const limit = await rateLimit("chat_order", String(session.id), 5, 10);
    if (!limit.ok) return { ok: false, error: `Bahut saari koshish ho gayi. ${limit.retryInMin} min baad try karein.` };
    const { addressId, method, expectedTotal } = parsed.data;

    const summary = await chatCheckoutAction({ addressId });
    if (!summary.ok) return { ok: false, error: "auth" in summary && summary.auth ? summary.error : "Please log in again." };
    if (summary.addressId !== addressId) return { ok: false, error: "Address nahi mila. Dobara chuniye." };
    const total = method === "cod" ? summary.quote?.cod.total : summary.quote?.payu.total;
    if (!summary.quote?.serviceable) return { ok: false, error: "Is pincode par delivery abhi available nahi hai." };
    if (method === "cod" && !summary.quote.cod.allowed) return { ok: false, error: summary.quote.cod.reason ?? "COD available nahi hai." };
    if (total !== expectedTotal) return { ok: false, changed: true, error: "Daam ya shipping badal gaya hai. Naya total dekh lijiye." };

    const [addresses, [[customer]]] = await Promise.all([
      listAddresses(session.id),
      db().query<RowDataPacket[]>("SELECT email FROM customers WHERE id=?", [session.id]),
    ]);
    const address = addresses.find((a) => a.id === addressId);
    if (!address) return { ok: false, error: "Address nahi mila." };
    const fd = new FormData();
    const fields: Record<string, string> = {
      method, name: address.name, phone: address.phone, email: String(customer?.email ?? ""),
      line1: address.line1, line2: [address.line2, address.landmark].filter(Boolean).join(", "),
      city: address.city, state: address.state, pincode: address.pincode, gstin: "", couponCode: "",
    };
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const result = await placeOrderCore(fd, "chat");
    if (!("placed" in result)) return { ok: false, error: result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Order place nahi ho paaya." };
    const [[row]] = await db().query<RowDataPacket[]>("SELECT order_no FROM orders WHERE id=?", [result.placed.orderId]);
    const orderNo = String(row?.order_no ?? result.placed.orderId);
    return result.placed.method === "cod"
      ? { ok: true, method: "cod", orderId: result.placed.orderId, orderNo }
      : { ok: true, method: "payu", orderId: result.placed.orderId, orderNo, payUrl: `/checkout/pay?t=${result.placed.token}` };
  })();
  placed.set(key, { at: Date.now(), result: run });
  const result = await run;
  // A failure that wasn't an order should be retryable with the same card.
  if (!result.ok) placed.delete(key);
  return result;
}
