import type { ProductVariant } from "./types";

/**
 * The size a product opens on: the admin's "Shown first" size when it is on sale,
 * otherwise `fallback` (each surface keeps its own old rule), otherwise the first size on sale.
 */
export function defaultVariant<V extends ProductVariant>(
  product: { variants: V[]; defaultSize?: string },
  fallback?: (onSale: V[]) => V | undefined,
): V | undefined {
  const onSale = product.variants.filter((v) => v.availableForSale);
  const want = product.defaultSize?.toLowerCase();
  return (
    (want ? onSale.find((v) => v.title.toLowerCase() === want) : undefined) ??
    fallback?.(onSale) ??
    onSale[0]
  );
}
