/**
 * Most units of one pack size a single order can hold (client's shipping carton, 2026-11-19).
 * Oils share one limit per bottle size across all oils (every oil uses the same bottle), e.g. 12 × 1 L
 * in total, any mix of oils. Sweeteners are limited per product. Above the limit the shopper is sent to
 * the bulk-order form. Used by the cart (server, the real guard) and the steppers (UI).
 */

/** Oils: bottle size in ml → max bottles of that size per order (all oils together). */
const OIL_ML: Record<number, number> = { 30: 10, 50: 10, 100: 192, 250: 96, 500: 24, 1000: 12, 2000: 9, 5000: 4, 15000: 4 };

/** Per product, all sizes together. */
const PER_PRODUCT: Record<string, number> = {
  "desi-khand": 5,
  "jaggery-powder": 5,
  "jaggery-block": 5,
  "jamun-raw-honey": 4,
  "sunderban-raw-honey": 4,
  "van-tulsi-raw-honey": 4,
};

/** Fallback for anything without a client limit. */
export const DEFAULT_MAX_QTY = 99;

type V = { sizeValue: number; sizeUnit: "ml" | "g" };

export type QtyLimit = {
  /** Lines with the same key share the limit. */
  key: string;
  max: number;
  /** "× 1 L bottles (all oils together)" / "× Desi Khand" — read after the number: "Max 12 × 1 L bottles". */
  label: string;
  /** True when the client set this limit (show the bulk-order note), false for the plain fallback. */
  client: boolean;
};

const sizeLabel = (ml: number) => (ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`);

export function qtyLimit(handle: string, variant: V, productTitle?: string): QtyLimit {
  if (variant.sizeUnit === "ml" && OIL_ML[variant.sizeValue]) {
    return { key: `oil:${variant.sizeValue}`, max: OIL_ML[variant.sizeValue], label: `× ${sizeLabel(variant.sizeValue)} bottles (all oils together)`, client: true };
  }
  if (PER_PRODUCT[handle]) {
    return { key: `p:${handle}`, max: PER_PRODUCT[handle], label: `× ${productTitle ?? handle}`, client: true };
  }
  return { key: `v:${handle}:${variant.sizeValue}${variant.sizeUnit}`, max: DEFAULT_MAX_QTY, label: productTitle ?? handle, client: false };
}

type Line = { id: string; quantity: number; variant: V & { id: string }; product: { handle: string } };

/** How many units of `variant` this line may hold, given what the rest of the cart already uses. */
export function maxForLine(lines: Line[], handle: string, variant: V & { id: string }, excludeLineId?: string) {
  const limit = qtyLimit(handle, variant);
  const usedElsewhere = lines
    .filter((l) => l.id !== excludeLineId && l.variant.id !== variant.id && qtyLimit(l.product.handle, l.variant).key === limit.key)
    .reduce((s, l) => s + l.quantity, 0);
  return Math.max(0, limit.max - usedElsewhere);
}

/** Bulk-order form link, prefilled with the product, the pack size and the per-order limit they hit. */
export function bulkOrderHref(productTitle: string, sizeTitle: string, max: number) {
  const p = new URLSearchParams({ product: productTitle.replace(/^(Wood|Cold)-Pressed\s+/, "").replace(/,\s*Wood-Pressed.*$/i, ""), size: sizeTitle, max: String(max) });
  return `/bulk-orders?${p}`;
}
