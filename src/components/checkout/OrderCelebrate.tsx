"use client";

import { useEffect, useState } from "react";
import { EASE } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { formatMoney } from "@/lib/utils/money";

const COLORS = ["#0c3c24", "#b49024", "#d0b17a", "#e8c879"];
const ease = [0.22, 1, 0.36, 1] as const;

async function burst() {
  const { default: confetti } = await import("canvas-confetti");
  confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0, y: 0.6 }, colors: COLORS, zIndex: 9999, disableForReducedMotion: true });
  confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.6 }, colors: COLORS, zIndex: 9999, disableForReducedMotion: true });
}

/** Circle + tick that draws itself. Used in the intro overlay and the page hero. */
export function SuccessTick({ size = 88, delay = 0, onDark = false }: { size?: number; delay?: number; onDark?: boolean }) {
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      {/* soft ripples */}
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className={onDark ? "absolute inset-0 rounded-full bg-mustard/30" : "absolute inset-0 rounded-full bg-forest/15"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.7], opacity: [0.7, 0] }}
          transition={{ duration: 1.4, delay: delay + 0.5 + i * 0.35, ease: EASE.out }}
        />
      ))}
      <motion.svg viewBox="0 0 52 52" width={size} height={size} className="relative" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay }}>
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          fill={onDark ? "#b49024" : "#0c3c24"}
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay, ease }}
          style={{ transformOrigin: "center" }}
        />
        <motion.path
          d="M15 27 l7.5 7.5 L38 19"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: delay + 0.3, ease: EASE.out }}
        />
      </motion.svg>
    </span>
  );
}

/**
 * First view of a confirmed order: a short full-screen "Payment successful / Order placed" intro
 * (tap to skip, ~2 s), then the page with a brand-coloured confetti burst. Shown once per order
 * per browser session and skipped entirely for reduced-motion users.
 */
export function OrderCelebrate({ orderNo, total, cod = false }: { orderNo: string; total?: number; cod?: boolean }) {
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    const key = `smp_celebrated_${orderNo}`;
    try {
      if (sessionStorage.getItem(key) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    // Defer so the state change is not a synchronous effect update.
    const show = setTimeout(() => setIntro(true), 0);
    const hide = setTimeout(() => setIntro(false), 2300);
    return () => (clearTimeout(show), clearTimeout(hide));
  }, [orderNo]);

  useEffect(() => {
    if (!intro) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => void (document.documentElement.style.overflow = prev);
  }, [intro]);

  return (
    <AnimatePresence onExitComplete={() => void burst()}>
      {intro && (
        <motion.div
          key="intro"
          role="status"
          aria-live="polite"
          onClick={() => setIntro(false)}
          className="fixed inset-0 z-[9998] flex cursor-pointer flex-col items-center justify-center bg-forest px-6 text-center text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ clipPath: "circle(0% at 50% 42%)", transition: { duration: 0.6, ease } }}
          style={{ clipPath: "circle(150% at 50% 42%)" }}
        >
          <SuccessTick size={104} delay={0.15} onDark />
          <motion.p
            className="mt-7 text-xs font-semibold tracking-[0.2em] text-mustard uppercase"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5, ease }}
          >
            {cod ? "Order placed" : "Payment successful"}
          </motion.p>
          {total !== undefined && (
            <motion.p
              className="mt-2 font-display text-4xl font-bold text-white tabular-nums md:text-5xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5, ease }}
            >
              {formatMoney(total)}
            </motion.p>
          )}
          <motion.p className="mt-3 text-sm text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.5 }}>
            Order <span className="font-mono text-white">{orderNo}</span> · thank you!
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
