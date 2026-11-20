"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The assistant (chat UI, blocks, zod, voice) is ~300 KB of JS. It loads after the page is
// interactive and the browser is idle, so it never competes with the hero image or first paint.
const ChatWidget = dynamic(() => import("./ChatWidget").then((m) => m.ChatWidget), { ssr: false });

export function ChatWidgetLazy() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let idle = 0;
    const go = () => setReady(true);
    const start = () => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) idle = w.requestIdleCallback(go, { timeout: 4000 });
      else idle = window.setTimeout(go, 2500);
    };
    // Any interaction means the shopper is engaged: load right away.
    const early = () => go();
    window.addEventListener("pointerdown", early, { once: true, passive: true });
    window.addEventListener("keydown", early, { once: true });
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.removeEventListener("pointerdown", early);
      window.removeEventListener("keydown", early);
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
      clearTimeout(idle);
    };
  }, []);
  return ready ? <ChatWidget /> : null;
}
