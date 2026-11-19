/**
 * Why a shopper is returning items (shared by the form, the chat flow and the server action).
 * Store policy: refunds/replacements only for products that arrive damaged or expired,
 * backed by an unboxing video (see /policies/refund-return).
 */
export const RETURN_REASONS = ["Damaged or leaking", "Expired on arrival"] as const;
