"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/shadcn/input-otp";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/shadcn/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils/cn";

/* Shared building blocks for the Profile & security page. */

export const card =
  "rounded-3xl border border-line bg-white p-5 shadow-co-card md:p-6";
export const field =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-forest focus:ring-4 focus:ring-forest/10 aria-invalid:border-co-danger";
export const btnPrimary =
  "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white transition hover:bg-forest-mid disabled:pointer-events-none disabled:opacity-50";
export const btnGhost =
  "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-co-border-strong hover:bg-co-panel disabled:pointer-events-none disabled:opacity-50";
export const btnDanger =
  "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-co-danger px-5 text-sm font-bold text-white transition hover:bg-co-danger/90 disabled:pointer-events-none disabled:opacity-50";

/** Card with icon tile, title, hint and an optional header action (e.g. Edit). */
export function SectionCard({
  icon: Icon,
  title,
  hint,
  action,
  children,
  className,
  id,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn(card, className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-co-accent-soft text-co-accent">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-bold text-ink">
            {title}
          </h2>
          {hint && <p className="text-sm text-ink-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Height-animated swap between view and edit content (instant when reduced motion is on). */
export function Collapse({ show, children }: { show: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "success" | "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "success" && "bg-co-success-soft text-co-success",
        tone === "warn" && "bg-co-accent-soft text-co-accent-ink",
        tone === "muted" && "bg-co-panel text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Warns before leaving the page with unsaved edits. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

/** Seconds left until `until` (ms timestamp), ticking once a second. */
export function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** Dialog on desktop, bottom sheet on phones. */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const mobile = useIsMobile();
  if (mobile)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="co-theme max-h-[92svh] overflow-y-auto rounded-t-3xl bg-white px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="text-xl text-ink">{title}</SheetTitle>
            {description && <SheetDescription className="text-ink-muted">{description}</SheetDescription>}
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="co-theme rounded-3xl bg-white p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-ink">{title}</DialogTitle>
          {description && <DialogDescription className="text-ink-muted">{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** 6-digit OTP boxes: auto-advance, paste, SMS autofill. */
export function OtpField({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ""))}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      aria-label="6-digit OTP"
      containerClassName="justify-center"
    >
      <InputOTPGroup className="gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            aria-invalid={invalid || undefined}
            className="size-12 rounded-xl border border-line bg-white text-lg font-semibold text-ink first:rounded-xl first:border-l last:rounded-xl data-[active=true]:border-forest data-[active=true]:ring-forest/15"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** Note shown in dev builds where no SMS is sent. */
export function DevCodeNote({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <p className="rounded-xl border border-dashed border-co-border-strong bg-co-accent-soft px-3 py-2 text-center text-xs text-ink-muted">
      Test mode: no SMS is sent. Your OTP is{" "}
      <span className="font-bold tracking-widest text-ink">{code}</span>.
    </p>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return (
    <p aria-live="polite" className={cn("text-sm text-co-danger", !error && "sr-only")}>
      {error}
    </p>
  );
}
