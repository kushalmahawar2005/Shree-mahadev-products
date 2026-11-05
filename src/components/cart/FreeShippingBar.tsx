"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { PartyPopper, Truck } from "lucide-react";
import { useStoreSettings } from "@/components/StoreSettingsProvider";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

/** Free-shipping progress: the truck rides along the bar; celebrates once unlocked. */
export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const threshold = useStoreSettings().shipping.freeShippingThreshold;
  const pct = threshold ? Math.min(100, (subtotal / threshold) * 100) : 100;
  const remaining = Math.max(0, threshold - subtotal);
  const done = remaining === 0;

  // Celebrate the moment the cart crosses the free-shipping line (not on every render).
  const prev = useRef(done);
  useEffect(() => {
    if (done && !prev.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const shoot = (x: number) =>
        confetti({ particleCount: 70, spread: 70, startVelocity: 38, origin: { x, y: 0.15 }, colors: ["#0c3c24", "#b49024", "#d0b17a", "#f6efe2"], zIndex: 9999 });
      shoot(0.82);
      setTimeout(() => shoot(0.92), 180);
    }
    prev.current = done;
  }, [done]);

  return (
    <div className={cn("rounded-2xl border p-3.5 transition-colors", done ? "border-forest/20 bg-forest/5" : "border-line bg-white")}>
      <p className="flex items-center gap-2 text-sm text-forest-text">
        {done ? (
          <>
            <PartyPopper className="size-4 text-mustard" aria-hidden />
            <strong>Yay! Free shipping unlocked</strong>
          </>
        ) : (
          <>
            <Truck className="size-4 text-forest" aria-hidden />
            <span>
              Add <strong>{formatMoney(remaining)}</strong> more for <strong>free shipping</strong>
            </span>
          </>
        )}
      </p>
      <div
        className="relative mt-3 h-2 rounded-full bg-khaki-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={Math.min(subtotal, threshold)}
        aria-label="Progress to free shipping"
      >
        <motion.div
          className="relative h-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#0c3c24,#2a6b44_60%,#b49024)] after:absolute after:inset-0 after:animate-[bar-shimmer_2.2s_linear_infinite] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent)] after:bg-[length:50%_100%] after:bg-no-repeat"
          initial={false}
          animate={{ width: `${Math.max(4, pct)}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.span
          className="absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-forest shadow-sm"
          initial={false}
          animate={{ left: `${Math.max(4, pct)}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        >
          <Truck className="size-3.5" />
        </motion.span>
      </div>
    </div>
  );
}
