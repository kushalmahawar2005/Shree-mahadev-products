"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useRef } from "react";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { cn } from "@/lib/utils/cn";
import { DUR, EASE } from "@/lib/motion";

/**
 * Side drawer: cart slides from the right (0.6s drawer curve), menu from the left (0.26s in / 0.2s out),
 * overlay fades to 30%, background scroll locked (Lenis stop),
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
  // Cart (right): 0.6s drawer curve both ways, overlay to 30%. Menu (left): quick 0.26s in, 0.2s ease-in out.
  const panelIn = side === "right" ? { duration: DUR.cartDrawer, ease: EASE.drawer } : { duration: DUR.menuOpen, ease: EASE.menuOpen };
  const panelOut = side === "right" ? panelIn : { duration: DUR.menuClose, ease: "easeIn" as const };
  const overlay = side === "right" ? { duration: DUR.cartDrawer, ease: "easeInOut" as const } : { duration: DUR.menuOpen };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            className={cn("absolute inset-0 bg-black", side === "right" && "backdrop-blur-[2px]")}
            initial={{ opacity: 0 }}
            animate={{ opacity: side === "right" ? 0.4 : 0.3 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0.15 } : overlay}
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
            initial={reduce ? { opacity: 0 } : { x }}
            animate={{ x: 0, opacity: 1, transition: reduce ? { duration: 0.15 } : panelIn }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.15 } } : { x, transition: panelOut }}
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
