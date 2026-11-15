"use client";

import { useSyncExternalStore } from "react";

/** Chrome / Android "install" event, captured once for the whole page. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own "Install app" button instead of the mini-infobar
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

const standalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

export type PwaState = "hidden" | "prompt" | "ios";

function snapshot(): PwaState {
  if (installed || standalone()) return "hidden";
  if (deferred) return "prompt";
  return ios() ? "ios" : "hidden";
}

export function usePwaInstall() {
  const state = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    snapshot,
    () => "hidden" as PwaState,
  );
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  };
  return { state, install };
}
