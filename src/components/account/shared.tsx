"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { cn } from "@/lib/utils/cn";

/* ───────────────────────── Order status ───────────────────────── */

type Tone =
  | "amber"
  | "blue"
  | "violet"
  | "indigo"
  | "teal"
  | "green"
  | "grey"
  | "red"
  | "orange";
const TONE: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  teal: "bg-teal-50 text-teal-800 ring-teal-200",
  green: "bg-co-success-soft text-co-success ring-co-success/25",
  grey: "bg-page text-ink-muted ring-line",
  red: "bg-co-danger/10 text-co-danger ring-co-danger/25",
  orange: "bg-orange-50 text-orange-800 ring-orange-200",
};

/** DB status → shopper-facing label + colour. */
export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending_payment: { label: "Awaiting payment", tone: "amber" },
  paid: { label: "Confirmed", tone: "blue" },
  cod_pending: { label: "Confirmed", tone: "blue" },
  confirmed: { label: "Confirmed", tone: "blue" },
  packed: { label: "Packed", tone: "violet" },
  shipped: { label: "Shipped", tone: "indigo" },
  out_for_delivery: { label: "Out for delivery", tone: "teal" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "grey" },
  payment_failed: { label: "Payment failed", tone: "red" },
  return_requested: { label: "Return requested", tone: "orange" },
  rto: { label: "Returned to us", tone: "orange" },
  refunded: { label: "Refunded", tone: "orange" },
  partially_refunded: { label: "Partly refunded", tone: "orange" },
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = ORDER_STATUS[status] ?? {
    label: status.replace(/_/g, " "),
    tone: "grey" as Tone,
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        TONE[s.tone],
        className,
      )}
    >
      {s.label}
    </span>
  );
}

/* ───────────────────────── Timeline ───────────────────────── */

import { TIMELINE_STEPS } from "@/lib/account/order-status";
export { TIMELINE_STEPS, stepOf } from "@/lib/account/order-status";

/**
 * Delivery progress. Horizontal on ≥md, vertical on phones (or always vertical with `vertical`).
 * Done = brand check (+ time), current = pulsing dot, future = muted outline.
 */
export function OrderTimeline({
  current,
  times = {},
  vertical,
}: {
  current: number;
  times?: Partial<Record<number, string>>;
  vertical?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <ol
      className={cn("flex", vertical ? "flex-col" : "flex-col md:flex-row")}
      aria-label="Order progress"
    >
      {TIMELINE_STEPS.map((label, i) => {
        const done =
          i < current || (i === current && i === TIMELINE_STEPS.length - 1);
        const now = i === current && !done;
        const last = i === TIMELINE_STEPS.length - 1;
        return (
          <li
            key={label}
            className={cn(
              "relative flex gap-3",
              vertical
                ? "pb-5 last:pb-0"
                : "pb-5 last:pb-0 md:flex-1 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center",
            )}
            aria-current={now ? "step" : undefined}
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute bg-co-border-strong/60",
                  vertical
                    ? "top-6 bottom-0 left-[11px] w-0.5"
                    : "top-6 bottom-0 left-[11px] w-0.5 md:top-[11px] md:right-[calc(-50%+14px)] md:bottom-auto md:left-[calc(50%+14px)] md:h-0.5 md:w-auto",
                )}
              >
                <motion.span
                  className="block size-full origin-top bg-forest md:origin-left"
                  initial={false}
                  animate={{ scale: i < current ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.5 }}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full",
                done
                  ? "bg-forest text-white"
                  : now
                    ? "bg-white ring-2 ring-forest"
                    : "bg-white ring-1 ring-co-border-strong",
              )}
            >
              {done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : now ? (
                <span
                  className={cn(
                    "size-2 rounded-full bg-forest",
                    !reduce && "animate-pulse",
                  )}
                />
              ) : null}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  done || now ? "text-ink" : "text-ink-muted",
                )}
              >
                {label}
              </span>
              {times[i] && (
                <span className="block text-xs text-ink-muted">{times[i]}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Phones: the same progress as OrderTimeline in one short row (segmented bar + where it is now),
 * so an order card isn't five rows tall. The full vertical timeline stays on the order page.
 */
export function OrderProgressMini({
  current,
  times = {},
}: {
  current: number;
  times?: Partial<Record<number, string>>;
}) {
  const reduce = useReducedMotion();
  const lastIdx = TIMELINE_STEPS.length - 1;
  const at = Math.min(Math.max(current, 0), lastIdx);
  const next = at < lastIdx ? TIMELINE_STEPS[at + 1] : null;
  return (
    <div aria-label={`Order progress: ${TIMELINE_STEPS[at]}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-ink">
          {TIMELINE_STEPS[at]}
          {times[at] && <span className="font-normal text-ink-muted"> · {times[at]}</span>}
        </p>
        {next && <p className="shrink-0 text-xs text-ink-muted">Next: {next}</p>}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden>
        {TIMELINE_STEPS.map((label, i) => (
          <span key={label} className="h-1.5 overflow-hidden rounded-full bg-co-border-strong/50">
            <motion.span
              className="block size-full origin-left rounded-full bg-forest"
              initial={false}
              animate={{ scaleX: i <= at ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.06 }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Generic bits ───────────────────────── */

/** Confirmation for anything destructive (never window.confirm). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="co-theme rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-ink">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-ink-muted">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 rounded-xl">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={cn(
              "h-11 rounded-xl text-white",
              danger
                ? "bg-co-danger hover:bg-co-danger/90"
                : "bg-forest hover:bg-forest-mid",
            )}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                await onConfirm();
                onOpenChange(false);
              });
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
