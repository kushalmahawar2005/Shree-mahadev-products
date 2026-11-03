import { site } from "@/data/site";
import { formatMoney } from "@/lib/utils/money";

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const threshold = site.freeShippingThreshold;
  const pct = Math.min(100, (subtotal / threshold) * 100);
  const remaining = Math.max(0, threshold - subtotal);

  return (
    <div>
      <p className="mb-2 text-sm text-forest-text">
        {remaining > 0 ? (
          <>
            Add <strong>{formatMoney(remaining)}</strong> more for free shipping
          </>
        ) : (
          <strong>You get free shipping</strong>
        )}
      </p>
      <div
        className="h-2 overflow-hidden rounded-full bg-khaki-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={Math.min(subtotal, threshold)}
        aria-label="Progress to free shipping"
      >
        <div
          className="h-full origin-left rounded-full bg-forest transition-transform duration-500 ease-[var(--ease-premium)]"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
}
