"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { cn } from "@/lib/utils/cn";

/**
 * Side drawer: slides in (0.35s), overlay fades, background scroll locked (Lenis stop),
 * Escape closes, focus moves in and is restored on close.
 */
export function Drawer({
  open,
  onClose,
  side = "right",
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left";
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onClose = () => onCloseRef.current();
    const prev = document.activeElement as HTMLElement | null;
    lockScroll();
    const t = setTimeout(() => panelRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      prev?.focus?.();
    };
  }, [open]);

  const x = side === "right" ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            className="absolute inset-0 bg-forest-deep/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            data-lenis-prevent=""
            initial={reduce ? false : { x }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x }}
            transition={{ duration: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute top-0 flex h-dvh w-full max-w-md flex-col bg-white outline-none",
              side === "right" ? "right-0" : "left-0",
              className,
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
