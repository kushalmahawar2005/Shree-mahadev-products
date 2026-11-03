"use client";

import type Lenis from "lenis";

/**
 * Shared Lenis instance + scroll lock. Drawers / menus / modals call
 * lockScroll() on open and unlockScroll() on close. Works with or without Lenis.
 */
let lenis: Lenis | null = null;
let locks = 0;

export function setLenis(instance: Lenis | null) {
  lenis = instance;
}

export function getLenis() {
  return lenis;
}

export function lockScroll() {
  locks += 1;
  if (locks > 1) return;
  lenis?.stop();
  document.documentElement.style.overflow = "hidden";
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;
  lenis?.start();
  document.documentElement.style.overflow = "";
}

export function headerOffset() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
  return -(parseInt(v, 10) || 72) - 12;
}

export function scrollToTarget(target: string | HTMLElement | number) {
  if (lenis) {
    lenis.scrollTo(target, { offset: typeof target === "number" ? 0 : headerOffset() });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: "smooth" });
    return;
  }
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (el instanceof HTMLElement) {
    const top = el.getBoundingClientRect().top + window.scrollY + headerOffset();
    window.scrollTo({ top, behavior: "smooth" });
  }
}
