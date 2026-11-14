"use client";

import { useSyncExternalStore } from "react";

const read = () => document.cookie.split("; ").some((c) => c === "smp_in=1");
const noop = () => () => {};

/**
 * Whether the shopper looks signed in (the readable `smp_in` hint set next to the session cookie).
 * UI only: null on the server / first paint, so nothing flips during hydration.
 */
export function useSignedIn(): boolean | null {
  return useSyncExternalStore(noop, read, () => null);
}
