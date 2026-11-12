"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

/** One brand-coloured confetti burst the first time a customer sees their confirmed order. */
export function OrderCelebrate({ orderNo }: { orderNo: string }) {
  useEffect(() => {
    const key = `smp_celebrated_${orderNo}`;
    try {
      if (
        sessionStorage.getItem(key) ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    const colors = ["#0c3c24", "#b49024", "#d0b17a", "#e8c879"];
    const t = setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.6 },
        colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.6 },
        colors,
        zIndex: 9999,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [orderNo]);
  return null;
}
