"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils/cn";
import { ADMIN_THEME_KEY } from "./theme-script";

type Theme = "light" | "dark";

function readTheme(): Theme {
  return document.documentElement.dataset.adminTheme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-admin-theme"] });
  return () => observer.disconnect();
}

function storedPreference(): string | null {
  try {
    return localStorage.getItem(ADMIN_THEME_KEY);
  } catch {
    return null;
  }
}

/**
 * Admin light/dark switch. Follows the OS theme until the admin picks one,
 * then remembers the choice per browser. Switching uses a circular
 * View Transition reveal from the button (skipped for reduced motion).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  // Animate the icon only after a click, not when hydration swaps in the stored theme.
  const [animateIcon, setAnimateIcon] = useState(false);

  // Keep following the OS theme while the admin hasn't chosen one.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const pref = storedPreference();
      if (pref !== "light" && pref !== "dark") {
        document.documentElement.dataset.adminTheme = mq.matches ? "dark" : "light";
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = (button: HTMLButtonElement) => {
    setAnimateIcon(true);
    const next: Theme = theme === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.adminTheme = next;
      try {
        localStorage.setItem(ADMIN_THEME_KEY, next);
      } catch {
        /* private mode: theme still applies for this page view */
      }
    };

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof document.startViewTransition !== "function") {
      apply();
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  };

  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={(e) => toggle(e.currentTarget)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative grid size-10 place-items-center overflow-hidden rounded-full border border-line text-forest-text transition-colors hover:border-forest hover:bg-khaki-soft",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={animateIcon ? { opacity: 0, rotate: -90, scale: 0.6 } : false}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={animateIcon ? { opacity: 0, rotate: 90, scale: 0.6 } : undefined}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="grid place-items-center"
        >
          {dark ? <MoonIcon /> : <SunIcon />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
