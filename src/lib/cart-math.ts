/**
 * Cart totals: one pure function (no React, no I/O) so the drawer and tests share the same math.
 * Amounts are whole rupees. The server re-prices everything at checkout; this is the shopper's estimate.
 */
export type MathLine = { price: number; mrp?: number | null; qty: number };
export type MathMilestone = { amount: number; value: number };
export type CartMathInput = {
  lines: MathLine[];
  freeShippingThreshold: number;
  shippingFee: number;
  /** Coupon discount already priced by the server for this cart (0 = none). */
  couponDiscount?: number;
  couponFreeShipping?: boolean;
  /** Spend-based discounts (best one applies). Empty = none. */
  milestones?: MathMilestone[];
  /** Whether a coupon may stack on top of a milestone discount. */
  stackCoupon?: boolean;
  prepaidPercent?: number;
};
export type CartMath = {
  items: number;
  subtotal: number;
  mrpTotal: number;
  mrpSavings: number;
  milestoneDiscount: number;
  couponDiscount: number;
  prepaidDiscount: number;
  freeShipping: boolean;
  shipping: number;
  total: number;
  totalSavings: number;
  /** % off the MRP-based "was" price (MRP + shipping) */
  percentOff: number;
  /** Next spend target (free shipping or a milestone) and how much more is needed. */
  next: { amount: number; remaining: number } | null;
};

export function cartMath(i: CartMathInput): CartMath {
  const items = i.lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = i.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const mrpTotal = i.lines.reduce((s, l) => s + Math.max(l.mrp ?? 0, l.price) * l.qty, 0);
  const mrpSavings = mrpTotal - subtotal;

  const ms = [...(i.milestones ?? [])].sort((a, b) => a.amount - b.amount);
  const milestone = ms.filter((m) => subtotal >= m.amount).at(-1);
  const milestoneDiscount = milestone ? Math.min(milestone.value, subtotal) : 0;

  let couponDiscount = Math.max(0, i.couponDiscount ?? 0);
  if (milestoneDiscount && couponDiscount && !i.stackCoupon) {
    // No stacking: keep whichever saves more.
    if (couponDiscount > milestoneDiscount) {
      return finish(couponDiscount, 0);
    }
    couponDiscount = 0;
  }
  return finish(couponDiscount, milestoneDiscount);

  function finish(coupon: number, milestoneOff: number): CartMath {
    const afterDiscounts = Math.max(0, subtotal - coupon - milestoneOff);
    const prepaidDiscount = i.prepaidPercent ? Math.round((afterDiscounts * i.prepaidPercent) / 100) : 0;
    const freeShipping = items > 0 && (subtotal >= i.freeShippingThreshold || !!i.couponFreeShipping);
    const shipping = items === 0 || freeShipping ? 0 : i.shippingFee;
    const total = afterDiscounts - prepaidDiscount + shipping;
    const was = mrpTotal + (items ? i.shippingFee : 0);
    const totalSavings = Math.max(0, was - total);
    const targets = [{ amount: i.freeShippingThreshold, value: 0 }, ...ms].filter((t) => t.amount > subtotal).sort((a, b) => a.amount - b.amount);
    return {
      items,
      subtotal,
      mrpTotal,
      mrpSavings,
      milestoneDiscount: milestoneOff,
      couponDiscount: coupon,
      prepaidDiscount,
      freeShipping,
      shipping,
      total,
      totalSavings,
      percentOff: was > 0 ? Math.round((totalSavings / was) * 100) : 0,
      next: items && targets[0] ? { amount: targets[0].amount, remaining: targets[0].amount - subtotal } : null,
    };
  }
}
