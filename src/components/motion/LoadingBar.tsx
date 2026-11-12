"use client";

import { useEffect, useRef } from "react";

/*
 * Thin top loading bar for async actions (add to cart, filters, variant changes).
 * Start: opacity 1 + scaleX(0.4). End: scaleX(1). On transitionend: hide and reset to scaleX(0).
 * Any component can report work with `useLoadingSignal(pending)`; overlapping work is counted.
 */

let active = 0;
const listeners = new Set<(busy: boolean) => void>();
const emit = () => listeners.forEach((l) => l(active > 0));

export const loadingBar = {
  start() {
    active++;
    if (active === 1) emit();
  },
  done() {
    if (active === 0) return;
    active--;
    if (active === 0) emit();
  },
};

/** Show the bar while `pending` is true. */
export function useLoadingSignal(pending: boolean) {
  useEffect(() => {
    if (!pending) return;
    loadingBar.start();
    return () => loadingBar.done();
  }, [pending]);
}

export function LoadingBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBusy = (busy: boolean) => {
      if (busy) {
        el.style.opacity = "1";
        el.style.transform = "scaleX(0.4)";
      } else if (el.style.opacity === "1") {
        el.style.transform = "scaleX(1)";
      }
    };
    const onEnd = () => {
      if (active > 0 || el.style.transform !== "scaleX(1)") return;
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = "scaleX(0)";
      void el.offsetWidth; // commit the reset before re-enabling the transition
      el.style.transition = "";
    };
    listeners.add(onBusy);
    el.addEventListener("transitionend", onEnd);
    return () => {
      listeners.delete(onBusy);
      el.removeEventListener("transitionend", onEnd);
    };
  }, []);
  return <div ref={ref} className="loading-bar" aria-hidden />;
}
