"use client";

import { usePathname } from "next/navigation";

/** Renders its children only on the home page (e.g. the seasonal toran, which overlaps page headings elsewhere). */
export function HomeOnly({ children }: { children: React.ReactNode }) {
  return usePathname() === "/" ? <>{children}</> : null;
}
