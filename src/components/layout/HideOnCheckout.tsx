"use client";

import { usePathname } from "next/navigation";

/** Distraction-free checkout: the full site chrome (header, footer, popups) is hidden there. */
export function HideOnCheckout({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/checkout") ? null : <>{children}</>;
}
