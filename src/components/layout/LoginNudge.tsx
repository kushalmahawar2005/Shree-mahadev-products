"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

/** Real things an account does on this store (no invented rewards). */
export const LOGIN_PERKS = [
  "Track every order in one place",
  "Faster checkout, address saved",
  "Reorder your favourites in one tap",
  "Get help or a call back on any order",
];

const KEY = "smp_login_nudge_at";
const EVERY_DAYS = 3;
const HIDDEN_ON = ["/login", "/account", "/checkout", "/cart"];

/**
 * Phones, signed out: a small bubble above the "Login" tab, once every few days, a few seconds
 * after the page settles. Dismiss (or open it) and it stays away until the next window.
 */
export function LoginNudge() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY) ?? 0);
    } catch {
      /* storage blocked: still show once */
    }
    if (Date.now() - last < EVERY_DAYS * 86400000) return;
    const t = setTimeout(() => setShow(true), 6000);
    return () => clearTimeout(t);
  }, [pathname]);

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="dialog"
          aria-label="Login benefits"
          data-float="login-nudge"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 w-[min(300px,calc(100vw-1rem))] rounded-2xl border border-line bg-white p-4 shadow-[0_18px_40px_-16px_rgba(7,47,27,0.45)]"
        >
          <button type="button" onClick={close} aria-label="Close" className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft">
            <X className="size-4" />
          </button>
          <p className="pr-6 font-semibold text-ink">Login in 10 seconds, just your phone</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-ink-muted">
            {LOGIN_PERKS.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-forest" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <Link href="/login" prefetch={false} onClick={close} className="mt-3 flex h-10 items-center justify-center rounded-full bg-forest text-sm font-semibold text-white">
            Login / Sign up
          </Link>
          {/* Tail pointing at the Login tab */}
          <span aria-hidden className="absolute right-[calc(12.5%-6px)] -bottom-1.5 size-3 rotate-45 border-r border-b border-line bg-white" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
