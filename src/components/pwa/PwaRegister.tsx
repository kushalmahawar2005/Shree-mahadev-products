"use client";

import { useEffect } from "react";
import "./pwa-store";

/** Registers the service worker (production only, so dev never serves stale files). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => console.error("SW register", e));
  }, []);
  return null;
}
