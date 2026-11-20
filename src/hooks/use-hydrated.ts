import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * false while React hydrates server HTML, true after. Use it to hold back client-only state (the cart,
 * saved choices) until hydration is done, so the first client render matches the server's HTML.
 */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
