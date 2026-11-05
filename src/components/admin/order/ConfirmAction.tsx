"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog";
import { Textarea } from "@/components/shadcn/textarea";
import { cn } from "@/lib/utils/cn";

/**
 * Confirmation dialog for irreversible order actions (replaces window.confirm/prompt).
 * With `reasonLabel`, a reason is required and passed to `onConfirm`.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  reasonLabel,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const needsReason = !!reasonLabel;

  return (
    <AlertDialog open={open} onOpenChange={(o) => (setOpen(o), o || setReason(""))}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border-line bg-surface">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-forest-text">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-ink-muted">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {needsReason && (
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-forest-text">{reasonLabel}</span>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className="rounded-xl" autoFocus />
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={needsReason && !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className={cn("rounded-full", destructive ? "bg-red-700 text-white hover:bg-red-800" : "bg-forest text-white hover:bg-forest-mid")}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
