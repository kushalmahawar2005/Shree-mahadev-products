"use client";

import { useEffect } from "react";

/**
 * Inline script for <body>: turns on the CSS "before" states of scroll reveals. The page itself is
 * painted straight away (it used to stay hidden until hydration + fonts, which delayed LCP on every
 * page). Fail-safe: if hydration has not happened after 3s, reveals are disabled so nothing can stay hidden.
 */
export const PAGE_OPEN_SCRIPT = `(function(){var h=document.documentElement;h.classList.add("js-motion");setTimeout(function(){if(!window.__smpReady){h.classList.add("motion-failsafe")}},3000)})();`;

/** Marks the app as hydrated (the fail-safe above checks this). */
export function PageReady() {
  useEffect(() => {
    (window as Window & { __smpReady?: boolean }).__smpReady = true;
  }, []);
  return null;
}
