"use client";

import { useEffect } from "react";

/**
 * Inline script for <body>: hides the page (opacity) until the app has hydrated and fonts are ready,
 * and turns on the CSS "before" states of scroll reveals. Fail-safe: if hydration has not happened
 * after 3s, everything is shown and reveals are disabled, so content can never stay hidden.
 */
export const PAGE_OPEN_SCRIPT = `(function(){var d=document,h=d.documentElement,b=d.body;h.classList.add("js-motion");b.setAttribute("data-unresolved","");setTimeout(function(){if(!window.__smpReady){h.classList.add("motion-failsafe");b.removeAttribute("data-unresolved")}},3000)})();`;

/** Removes `data-unresolved` once hydrated and fonts are ready → body fades in (0.2s ease-in). */
export function PageReady() {
  useEffect(() => {
    (window as Window & { __smpReady?: boolean }).__smpReady = true;
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      document.body.removeAttribute("data-unresolved");
    };
    const cap = setTimeout(show, 800); // never wait long on slow font loads
    document.fonts?.ready.then(show, show);
    return () => clearTimeout(cap);
  }, []);
  return null;
}
