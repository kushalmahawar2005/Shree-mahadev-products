"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Hydration-safe "prefers reduced motion".
 *
 * motion's own `useReducedMotion()` reads the media query on the first client render, while the
 * server has no way to know it, so `initial={reduce ? false : {...}}` rendered different HTML on
 * each side for reduced-motion visitors (hydration error). This returns `false` during SSR and
 * hydration, then the real value right after, so both sides match.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
