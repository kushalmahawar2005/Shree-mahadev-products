import type { ProductVariant } from "@/lib/commerce/types";
import { formatMoney } from "./money";

/** "₹57.20 / 100ml". Returns null if the variant has no price. */
export function unitPrice(v: Pick<ProductVariant, "price" | "sizeValue" | "sizeUnit">) {
  if (!v.price.amount || !v.sizeValue) return null;
  const per100 = (v.price.amount / v.sizeValue) * 100;
  return `${formatMoney(per100, true)} / 100${v.sizeUnit}`;
}
