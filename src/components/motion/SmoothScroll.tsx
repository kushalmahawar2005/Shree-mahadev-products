"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { headerOffset, setLenis } from "./scroll-lock";

/**
 * Lenis smooth scrolling for desktop (wheel). Touch devices keep native scroll.
 * Off entirely when the user prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");

    let raf = 0;
    const start = () => {
      if (lenisRef.current || reduce.matches || coarse.matches) return;
      const lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: headerOffset() },
        stopInertiaOnNavigate: true,
        allowNestedScroll: true,
      });
      lenisRef.current = lenis;
      setLenis(lenis);
      const loop = (time: number) => {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      lenisRef.current?.destroy();
      lenisRef.current = null;
      setLenis(null);
    };

    start();
    const onChange = () => (reduce.matches || coarse.matches ? stop() : start());
    reduce.addEventListener("change", onChange);
    coarse.addEventListener("change", onChange);
    return () => {
      reduce.removeEventListener("change", onChange);
      coarse.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  // Route change: glide to top (unless navigating to a hash).
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const lenis = lenisRef.current;
    if (!lenis || window.location.hash) return;
    lenis.resize();
    lenis.scrollTo(0, { immediate: window.scrollY > 2000, duration: 0.6 });
  }, [pathname]);

  return <>{children}</>;
}
