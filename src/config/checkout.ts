import { cartConfig } from "./cart";

/**
 * Checkout settings in one place (placeholders until the client confirms).
 *
 * Free-shipping threshold, flat shipping fee, COD on/off, COD fee and the COD order cap are
 * edited in Admin → Settings → Shipping (store settings), so the cart, checkout and server all
 * read the same numbers. This file holds what is not in the admin yet.
 */
export const checkoutConfig = {
  /** Online-payment discount in %. Shared with the cart drawer. Keep 0 until the server applies it. */
  prepaidDiscountPercent: cartConfig.prepaidDiscountPercent,
  /** "Goes well with your order" picks in checkout → Add more (handles, in order). Falls back to
   *  categories the shopper doesn't have yet, then bestsellers. Shared with the cart drawer. */
  upsellHandles: cartConfig.upsellHandles,
  /** Packed weight (grams) used when a variant has no weight set. */
  defaultPackageWeightGrams: 1000,
  /** Shown when the courier doesn't return a delivery estimate (e.g. flat-rate fallback). */
  fallbackEtaDays: { min: 4, max: 7 },
  /** Public pincode → city/state lookup. A local prefix table is the fallback. */
  pincodeLookupUrl: "https://api.postalpincode.in/pincode/",
  policyLinks: [
    { label: "Shipping", href: "/policies/shipping" },
    { label: "Refunds", href: "/policies/refund-return" },
    { label: "Privacy", href: "/policies/privacy" },
    { label: "Terms", href: "/policies/terms" },
  ],
} as const;
