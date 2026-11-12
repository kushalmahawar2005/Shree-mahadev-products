"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  PackageX,
  RotateCcw,
  Undo2,
  X,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn/tooltip";
import type { TimelineEntry } from "@/lib/account/order-ui";
import { useCart } from "@/components/cart/CartProvider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { requestReturnAction } from "@/lib/account/order-actions";
import { RETURN_REASONS } from "@/lib/account/returns";
import { cancelMyOrderAction } from "@/lib/customer-account-actions";
import { cn } from "@/lib/utils/cn";
import { ConfirmDialog } from "./shared";

import { primaryBtn, secondaryBtn } from "@/lib/account/ui-classes";

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Want to change items or address",
  "Found a better price",
  "Delivery is too slow",
  "Other",
] as const;

/** Per-line "Buy again": adds that size + qty and opens the cart drawer. */
export function BuyAgainLine({ variantKey, qty }: { variantKey: string; qty: number }) {
  const { add, open } = useCart();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await add(variantKey, qty);
          open();
        })
      }
      className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-forest hover:bg-co-brand-soft disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
      Buy again
    </button>
  );
}

/** Whole order back into the cart. */
export function BuyAgainAll({
  items,
  label = "Reorder all",
  className = primaryBtn,
}: {
  items: { variantKey: string; qty: number }[];
  label?: string;
  className?: string;
}) {
  const { add, open } = useCart();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          for (const i of items) await add(i.variantKey, i.qty);
          open();
        })
      }
      className={className}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
      {label}
    </button>
  );
}

export function CancelOrderButton({ orderId, orderNo }: { orderId: number; orderNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof CANCEL_REASONS)[number]>(CANCEL_REASONS[0]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(secondaryBtn, "text-co-danger")}>
        <PackageX className="size-4" /> Cancel order
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Cancel order ${orderNo}?`}
        description="Items go back to stock. This can't be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        danger
        onConfirm={async () => {
          const r = await cancelMyOrderAction({ orderId, reason });
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(`Order ${orderNo} cancelled`);
          router.refresh();
        }}
      >
        <label className="block text-sm font-medium text-ink">
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof CANCEL_REASONS)[number])}
            className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none focus-visible:border-forest"
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </ConfirmDialog>
    </>
  );
}

type ReturnLine = { variantKey: string; title: string; variant: string; qty: number; eligible: boolean };

/** Request a return: pick items + qty → reason → optional note. Dialog on desktop, bottom sheet on mobile. */
export function ReturnRequest({
  orderId,
  lines,
  daysLeft,
}: {
  orderId: number;
  lines: ReturnLine[];
  daysLeft: number;
}) {
  const mobile = useIsMobile();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<(typeof RETURN_REASONS)[number] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const chosen = Object.entries(picked).filter(([, q]) => q > 0);
  const submit = () =>
    start(async () => {
      setError(null);
      if (!chosen.length) return setError("Pick at least one item.");
      if (!reason) return setError("Choose a reason.");
      const r = await requestReturnAction({
        orderId,
        items: chosen.map(([variantKey, qty]) => ({ variantKey, qty })),
        reason,
        note: note.trim() || undefined,
      });
      if (!r.ok) return setError(r.error);
      toast.success("Return requested. We'll WhatsApp you within a day.");
      setOpen(false);
      router.refresh();
    });

  const body = (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Which items?</legend>
        <ul className="mt-2 space-y-2">
          {lines.map((l) => {
            const q = picked[l.variantKey] ?? 0;
            return (
              <li
                key={l.variantKey}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3",
                  q ? "border-forest/40 bg-co-brand-soft" : "border-line",
                  !l.eligible && "opacity-60",
                )}
              >
                <button
                  type="button"
                  disabled={!l.eligible}
                  aria-pressed={q > 0}
                  onClick={() => setPicked((p) => ({ ...p, [l.variantKey]: q ? 0 : l.qty }))}
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md border",
                    q ? "border-forest bg-forest text-white" : "border-co-border-strong bg-white",
                  )}
                >
                  {q > 0 && <Check className="size-4" />}
                  <span className="sr-only">Select {l.title}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{l.title}</p>
                  <p className="text-xs text-ink-muted">
                    {l.variant}
                    {!l.eligible && " · not returnable"}
                  </p>
                </div>
                {q > 0 && l.qty > 1 && (
                  <select
                    aria-label={`Quantity of ${l.title}`}
                    value={q}
                    onChange={(e) => setPicked((p) => ({ ...p, [l.variantKey]: Number(e.target.value) }))}
                    className="h-10 rounded-lg border border-line bg-white px-2 text-base"
                  >
                    {Array.from({ length: l.qty }, (_, i) => i + 1).map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Reason</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RETURN_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                reason === r ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-co-border-strong",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold text-ink">
        Anything else? <span className="font-normal text-ink-muted">(optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="E.g. the cap was broken and oil leaked into the box."
          className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base font-normal text-ink outline-none focus-visible:border-forest"
        />
      </label>
      <p className="text-xs text-ink-muted">
        Have photos of the damage? Send them on WhatsApp after submitting, it speeds up the refund.
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-co-danger">
          {error}
        </p>
      )}
      <button type="button" onClick={submit} disabled={pending} className={primaryBtn}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Submit return request
      </button>
    </div>
  );

  const title = "Request a return";
  const desc = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in the return window.`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
        <Undo2 className="size-4" /> Request return
      </button>
      {mobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[90svh] overflow-y-auto rounded-t-3xl px-5 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{desc}</SheetDescription>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{desc}</DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


/* ───────────── Order detail: header bits, timeline, tracking ───────────── */

/** Copy icon button with a "Copied" tooltip + polite live region. */
export function CopyId({ value, label, className }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={done || undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Copy ${label}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setDone(true);
                setTimeout(() => setDone(false), 1500);
              } catch {
                toast.error("Couldn't copy. Long-press to select instead.");
              }
            }}
            className={cn(
              "inline-grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-page hover:text-ink",
              className,
            )}
          >
            {done ? <Check className="size-4 text-co-success" /> : <Copy className="size-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{done ? "Copied" : `Copy ${label}`}</TooltipContent>
      </Tooltip>
      <span className="sr-only" aria-live="polite">
        {done ? `${label} copied` : ""}
      </span>
    </TooltipProvider>
  );
}

/** "⋯" menu: invoice, help, copy link. */
export function MoreMenu({
  invoiceHref,
  helpHref,
  className,
}: {
  invoiceHref: string | null;
  helpHref: string;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More order actions"
        className={cn(
          "inline-grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink hover:border-co-border-strong",
          className,
        )}
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {invoiceHref ? (
          <DropdownMenuItem asChild>
            <a href={invoiceHref} className="h-10">
              <FileText className="size-4" /> Download invoice
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="h-10">
            <FileText className="size-4" /> Invoice not available yet
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={helpHref} target="_blank" rel="noopener noreferrer" className="h-10">
            <MessageCircle className="size-4" /> Need help
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-10"
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast.success("Order link copied");
            } catch {
              toast.error("Couldn't copy the link.");
            }
          }}
        >
          <Link2 className="size-4" /> Copy order link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Invoice/credit-note download link with a spinner while the server renders the PDF. */
export function DownloadLink({ href, label, className }: { href: string; label: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <a
      href={href}
      onClick={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), 4000);
      }}
      className={className}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
      {label}
    </a>
  );
}

/** Real order history: done steps in brand with time, current pulsing, cancelled in danger. Steps draw in. */
export function EventTimeline({ steps, times }: { steps: TimelineEntry[]; times: Record<string, string> }) {
  const reduce = useReducedMotion();
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <motion.li
            key={s.key}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.07 }}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last && (
              <motion.span
                aria-hidden
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.07 + 0.1 }}
                className={cn(
                  "absolute top-7 bottom-0 left-[13px] w-0.5 origin-top",
                  s.state === "done" && steps[i + 1]?.state !== "todo" ? "bg-forest" : "bg-line",
                )}
              />
            )}
            <span
              className={cn(
                "relative grid size-7 shrink-0 place-items-center rounded-full",
                s.state === "done" && "bg-forest text-white",
                s.state === "current" && "bg-co-brand-soft ring-2 ring-forest",
                s.state === "todo" && "bg-white ring-2 ring-co-border-strong",
                s.state === "cancelled" && "bg-co-danger text-white",
              )}
            >
              {s.state === "done" && <Check className="size-4" strokeWidth={3} />}
              {s.state === "cancelled" && <X className="size-4" strokeWidth={3} />}
              {s.state === "current" && (
                <span className="size-2.5 rounded-full bg-forest motion-safe:animate-pulse" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  s.state === "todo" ? "text-ink-muted" : s.state === "cancelled" ? "text-co-danger" : "text-ink",
                )}
              >
                {s.label}
              </p>
              {times[s.key] && <p className="text-xs text-ink-muted">{times[s.key]}</p>}
              {s.note && <p className="mt-0.5 text-xs text-ink">{s.note}</p>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Collapsible courier scan list (newest first). */
export function TrackingUpdates({
  events,
}: {
  events: { label: string; location: string | null; at: string }[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-5 rounded-2xl border border-line">
      <CollapsibleTrigger className="flex h-12 w-full items-center justify-between px-4 text-sm font-semibold text-ink">
        Tracking updates ({events.length})
        <ChevronDown className={cn("size-4 text-ink-muted transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <AnimatePresence initial={false}>
          <ol className="space-y-4 border-t border-line px-4 py-4">
            {events.map((t, i) => (
              <li key={`${t.at}-${i}`} className="flex gap-3">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    i === 0 ? "bg-forest ring-4 ring-co-brand-soft" : "bg-co-border-strong",
                  )}
                />
                <div className="min-w-0">
                  <p className={cn("text-sm", i === 0 ? "font-semibold text-ink" : "text-ink")}>
                    {t.label}
                    {t.location && <span className="text-ink-muted"> · {t.location}</span>}
                  </p>
                  <p className="text-xs text-ink-muted">{t.at}</p>
                </div>
              </li>
            ))}
          </ol>
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Fade + rise wrapper for cards (staggered by index). */
export function Reveal({ i = 0, className, children }: { i?: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.05 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
