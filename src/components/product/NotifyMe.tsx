"use client";

import { useState, useTransition } from "react";
import { notifyMeAction } from "@/lib/stock-actions";
import { cn } from "@/lib/utils/cn";

/** Out-of-stock CTA: collects a mobile number for a back-in-stock message. */
export function NotifyMe({ variantKey, sizeLabel, compact = false }: { variantKey: string; sizeLabel: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const btn = cn(
    "inline-flex w-full items-center justify-center rounded-full border border-forest px-4 font-semibold text-forest transition-colors duration-200 hover:bg-forest hover:text-white",
    compact ? "h-10 text-sm md:h-11" : "min-h-12 text-base",
  );

  if (state?.ok) return <p className={cn("rounded-full bg-khaki-soft px-4 text-center text-sm font-semibold text-forest-text", compact ? "py-2.5" : "py-3.5")}>{state.text}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        Notify me
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await notifyMeAction({ variantKey, phone });
          setState(r.ok ? { ok: true, text: `We'll WhatsApp you when ${sizeLabel} is back.` } : { ok: false, text: r.error });
        });
      }}
      className="space-y-1.5"
    >
      <div className="flex gap-1.5">
        <label className="sr-only" htmlFor={`nm-${variantKey}`}>
          Mobile number
        </label>
        <input
          id={`nm-${variantKey}`}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="Mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={cn("min-w-0 flex-1 rounded-full border border-line px-3 text-sm focus:border-forest focus:outline-none", compact ? "h-10" : "h-12")}
        />
        <button type="submit" disabled={pending} className={cn("shrink-0 rounded-full bg-forest px-4 text-sm font-semibold text-white disabled:opacity-60", compact ? "h-10" : "h-12")}>
          {pending ? "…" : "Notify"}
        </button>
      </div>
      {state && !state.ok && <p className="text-xs text-sale">{state.text}</p>}
    </form>
  );
}
