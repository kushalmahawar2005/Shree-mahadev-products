"use client";

import { useEffect, useState } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * True once the page has loaded and the browser is idle (or the shopper first taps / types).
 * Components that are only needed after an interaction (cart drawer, menus, chat) mount behind this,
 * so their code is split out of the first load and fetched when nothing else is competing for it.
 */
export function useIdleReady(timeout = 4000) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as IdleWindow;
    let idle = 0;
    let timer = 0;
    const go = () => setReady(true);
    const start = () => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(go, { timeout });
      else timer = window.setTimeout(go, 2500);
    };
    window.addEventListener("pointerdown", go, { once: true, passive: true });
    window.addEventListener("keydown", go, { once: true });
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, [timeout]);
  return ready;
}
