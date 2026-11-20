"use client";

import { motion, useReducedMotion } from "motion/react";
import { Mail } from "lucide-react";
import { WhatsApp } from "@/components/icons/duo";
import { cn } from "@/lib/utils/cn";

export type LoginMethod = "whatsapp" | "email";

const OPTIONS: { id: LoginMethod; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "whatsapp", label: "WhatsApp", Icon: WhatsApp },
  { id: "email", label: "Email", Icon: Mail },
];

/**
 * WhatsApp | Email switch above the login form (segmented control, sliding thumb).
 * `layoutId` must be unique per mounted instance (header menu and /login page can both be on screen).
 */
export function LoginMethodToggle({
  value,
  onChange,
  layoutId,
  className,
}: {
  value: LoginMethod;
  onChange: (m: LoginMethod) => void;
  layoutId: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div role="tablist" aria-label="Log in with" className={cn("grid grid-cols-2 rounded-full border border-line bg-ivory/60 p-1", className)}>
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-forest/40",
              active ? "text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full bg-forest shadow-[0_6px_14px_-8px_rgba(7,47,27,0.6)]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Icon className="relative size-4" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
