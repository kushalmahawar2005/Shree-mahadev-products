/**
 * Cart drawer settings in one place (the client can change these).
 *
 * Only REAL offers go live here: everything shown in the cart must also be applied at checkout.
 * - Free shipping comes from Admin → Settings (freeShippingThreshold), not from this file.
 * - Discount milestones / prepaid discount are OFF until the client confirms the amounts AND the
 *   checkout applies them server-side (see owner decision 2026-11-12: no mock offers).
 */
export type Milestone =
  | { type: "shipping"; reward: string } // amount = free-shipping threshold from store settings
  | { type: "discount"; amount: number; reward: string; value: number };

export const cartConfig = {
  /** Extra milestones after free shipping. Leave empty until the checkout supports them. */
  discountMilestones: [] as Extract<Milestone, { type: "discount" }>[],
  // Example once confirmed + implemented in checkout:
  // discountMilestones: [{ type: "discount", amount: 3000, reward: "₹150 off", value: 150 }],

  /** Online-payment discount in %. 0 = hidden everywhere. */
  prepaidDiscountPercent: 0,

  /** Rotating strip at the top of the drawer: only true, verifiable claims. */
  trustMessages: ["FSSAI licensed · every batch lab tested", "Wood-pressed in our own kachi ghani", "Made the Swadeshi way in Bijainagar"],

  /** Small add-ons suggested in the drawer (handles); falls back to bestsellers when empty. */
  upsellHandles: [] as string[],

  /** How long the "Removed … · Undo" notice stays. */
  undoMs: 5000,
} as const;
