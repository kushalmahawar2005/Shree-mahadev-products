import type { Money } from "@/lib/commerce/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(m: Money | number, precise = false) {
  const amount = typeof m === "number" ? m : m.amount;
  return (precise ? inrPrecise : inr).format(amount);
}

/** Discount percent, rounded down. Returns 0 when no real discount. */
export function discountPercent(price: Money, compareAt?: Money) {
  if (!compareAt || compareAt.amount <= price.amount || price.amount <= 0) return 0;
  return Math.floor(((compareAt.amount - price.amount) / compareAt.amount) * 100);
}

/** Only show discount badges at ≥10% off (AGENTS.md §9). */
export const DISCOUNT_BADGE_MIN = 10;
