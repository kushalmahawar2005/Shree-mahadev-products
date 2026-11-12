"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
import { checkDeliveryAction, type DeliveryCheck as Result } from "@/lib/delivery-actions";
import { formatMoney } from "@/lib/utils/money";
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

/** Pincode → "Delivers by Sat, 15 Nov · FREE shipping · COD available" (NimbusPost quote on the server). */
export function DeliveryCheck({ variant, qty }: { variant: ProductVariant; qty: number }) {
  const [pin, setPin] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const check = (p: string) =>
    start(async () => {
      const r = await checkDeliveryAction({
        pincode: p,
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
    <div className="mt-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{6}$/.test(pin)) check(pin);
          else setRes({ ok: false, error: "Enter a valid 6-digit pincode." });
        }}
        className="flex h-11 items-center rounded-full border border-line bg-white pl-4 focus-within:border-forest"
      >
        <MapPin className="size-4 shrink-0 text-ink-muted" />
        <label htmlFor="pdp-pin" className="sr-only">
          Pincode
        </label>
        <input
          id="pdp-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter pincode"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-ink outline-none"
        />
        <button type="submit" disabled={pending} className="mr-1 inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold text-forest hover:bg-co-brand-soft">
          {pending && <Loader2 className="size-3.5 animate-spin" />} Check delivery
        </button>
      </form>
      <div aria-live="polite" className="mt-2 min-h-5 text-sm">
        {res && !res.ok && <p className="text-co-danger">{res.error}</p>}
        {res?.ok && res.serviceable && (
          <p className="flex items-start gap-1.5 text-ink">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-co-success" />
            <span>
              Delivers by <b>{res.by}</b> to {res.place} ·{" "}
              {res.freeShipping ? <b className="text-co-success">FREE shipping</b> : `Shipping ${formatMoney(res.shipping)}`}
              {res.cod ? " · Cash on delivery available" : ""}
            </span>
          </p>
        )}
        {res?.ok && !res.serviceable && (
          <p className="flex items-center gap-1.5 text-co-danger">
            <XCircle className="size-4" /> Not serviceable to {res.place} yet.
          </p>
        )}
      </div>
    </div>
  );
}
