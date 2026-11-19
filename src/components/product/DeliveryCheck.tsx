"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MapPin, Truck, XCircle } from "lucide-react";
import { checkDeliveryAction, type DeliveryCheck as Result } from "@/lib/delivery-actions";
import type { ProductVariant } from "@/lib/commerce/types";

// Shared with checkout: the pincode lives in the checkout draft so it's prefilled on both pages.
const DRAFT_KEY = "smp_checkout_draft";
const readPin = () => {
  try {
    const p = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}")?.pincode;
    return typeof p === "string" && /^\d{6}$/.test(p) ? p : "";
  } catch {
    return "";
  }
};
const savePin = (pincode: string) => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") ?? {};
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, pincode }));
  } catch {
    /* storage blocked: fine */
  }
};

/** Pincode → "Delivers by Sat, 15 Nov to Jaipur" (NimbusPost quote on the server). */
export function DeliveryCheck({ handle, variant, qty }: { handle: string; variant: ProductVariant; qty: number }) {
  const [pin, setPin] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const check = (p: string) =>
    start(async () => {
      const r = await checkDeliveryAction({
        pincode: p,
        handle,
        sizeValue: variant.sizeValue,
        sizeUnit: variant.sizeUnit,
        qty,
        subtotal: variant.price.amount * qty,
      });
      setRes(r);
      if (r.ok) savePin(p);
    });

  // Prefill + auto-check a remembered pincode once.
  useEffect(() => {
    const p = readPin();
    if (!p) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage
    setPin(p);
    check(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white p-3 sm:p-3.5">
      <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-ink">
        <Truck className="size-4 text-forest" /> Delivery date
        <span className="font-normal text-ink-muted">· check your pincode</span>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{6}$/.test(pin)) check(pin);
          else setRes({ ok: false, error: "Enter a valid 6-digit pincode." });
        }}
        className="flex h-12 items-center gap-2 rounded-full border-[1.5px] border-line bg-page/60 p-1 pl-1 transition-colors focus-within:border-forest focus-within:bg-white"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-co-brand-soft text-forest">
          <MapPin className="size-4" />
        </span>
        <label htmlFor="pdp-pin" className="sr-only">
          Pincode
        </label>
        <input
          id="pdp-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter 6-digit pincode"
          className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold tracking-[0.12em] text-ink outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-70"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Check
        </button>
      </form>
      <div aria-live="polite" className="text-sm empty:hidden">
        {res && !res.ok && <p className="mt-2 px-1 text-co-danger">{res.error}</p>}
        {res?.ok && res.serviceable && (
          <p className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-co-success-soft px-3 py-2.5 text-ink">
            <CheckCircle2 className="size-5 shrink-0 text-co-success" />
            {/* Date + city only: free delivery and COD are stated once, in the trust strip. */}
            <span className="leading-snug">
              Delivers by <b className="text-forest">{res.by}</b>
              <span className="block text-xs text-ink-muted">to {res.place}</span>
            </span>
          </p>
        )}
        {res?.ok && !res.serviceable && (
          <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-alert-soft px-3 py-2.5 text-co-danger">
            <XCircle className="size-4 shrink-0" /> Not serviceable to {res.place} yet.
          </p>
        )}
      </div>
    </div>
  );
}
