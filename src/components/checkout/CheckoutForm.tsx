"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Check, CreditCard, Loader2, Lock, MapPin, ShieldCheck, TicketPercent, Truck, User, X } from "lucide-react";
import { useStoreSettings } from "@/components/StoreSettingsProvider";
import { INDIAN_STATES } from "@/lib/checkout";
import { placeOrderAction, quoteShippingAction, saveCheckoutContactAction, type CheckoutState, type ShippingQuoteResult } from "@/lib/checkout-actions";
import { validateCheckoutCouponAction } from "@/lib/coupon-actions";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

type Line = {
  id: string;
  title: string;
  variant: string;
  quantity: number;
  lineTotal: number;
  image?: { url: string; alt: string };
};

const field =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10";
const DRAFT_KEY = "smp_checkout_draft";
const DRAFT_FIELDS = ["name", "phone", "email", "line1", "line2", "city", "state"] as const;

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

function Field({ label, name, error, className, ...props }: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
      <input name={name} className={cn(field, error && "border-alert focus:border-alert focus:ring-alert/10")} aria-invalid={!!error} {...props} />
      {error && <span className="mt-1 block text-xs text-alert">{error}</span>}
    </label>
  );
}

function Step({ n, icon: Icon, title, hint, children }: { n: number; icon: typeof User; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:p-7">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest text-sm font-bold text-white">{n}</span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg md:text-xl">
            {title} <Icon className="size-4 text-forest/50" />
          </h2>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function CheckoutForm({ lines, subtotal }: { lines: Line[]; subtotal: number }) {
  const { shipping: ship } = useStoreSettings();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, undefined);
  const [chosenMethod, setMethod] = useState<"payu" | "cod">("payu");
  const [pincode, setPincode] = useState("");
  const [quote, setQuote] = useState<ShippingQuoteResult | null>(null);
  const [quoting, startQuote] = useTransition();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; freeShipping: boolean } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponPending, startCoupon] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors ?? {};
  const payUrl = state?.payUrl;

  // Restore the saved draft after mount (localStorage is client-only, so never during render).
  useEffect(() => {
    let draft: Record<string, string> = {};
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") ?? {};
    } catch {
      return;
    }
    const f = formRef.current;
    if (!f) return;
    for (const k of DRAFT_FIELDS) {
      const el = f.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null;
      if (el && !el.value && typeof draft[k] === "string") el.value = draft[k];
    }
    const raf = requestAnimationFrame(() => {
      if (draft.pincode) onPincode(draft.pincode);
      if (draft.method === "cod" || draft.method === "payu") setMethod(draft.method);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Save what the customer typed so a refresh or a closed tab doesn't lose it.
  function saveDraft() {
    const f = formRef.current;
    if (!f) return;
    const data: Record<string, string> = { pincode, method: chosenMethod };
    for (const k of DRAFT_FIELDS) data[k] = (f.elements.namedItem(k) as HTMLInputElement | null)?.value ?? "";
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      // private mode / storage full: nothing to do
    }
  }
  useEffect(saveDraft, [pincode, chosenMethod]);

  // Full page load to the PayU hand-off page (see placeOrderAction).
  useEffect(() => {
    if (payUrl) window.location.assign(payUrl);
  }, [payUrl]);

  function onPincode(value: string) {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    setPincode(pin);
    setQuote(null);
    // Cheapest courier for this pincode (the server re-quotes on submit).
    if (/^[1-9]\d{5}$/.test(pin)) startQuote(async () => setQuote(await quoteShippingAction(pin)));
  }

  const codBlocked = quote?.ok === true && quote.cod.shipping < 0;
  const codAllowed = ship.codEnabled && !codBlocked && !(ship.codMaxOrder && subtotal > ship.codMaxOrder);
  const method = codAllowed ? chosenMethod : "payu";

  const known = quote?.ok && quote.serviceable;
  const shipping = known ? (method === "cod" ? quote.cod.shipping : quote.payu.shipping) : null;
  const codFee = known && method === "cod" ? quote.cod.codFee : 0;
  const finalShipping = appliedCoupon?.freeShipping ? 0 : shipping;
  const total = subtotal - (appliedCoupon?.discount ?? 0) + (finalShipping ?? 0) + codFee;
  const items = lines.reduce((s, l) => s + l.quantity, 0);
  const blocked = quote?.ok === true && !quote.serviceable;

  function applyCoupon() {
    setCouponError("");
    startCoupon(async () => {
      const phone = (formRef.current?.elements.namedItem("phone") as HTMLInputElement | null)?.value ?? "";
      const result = await validateCheckoutCouponAction({ code: couponCode, phone });
      if (!result.ok) {
        setAppliedCoupon(null);
        setCouponError(result.error ?? "This code can't be applied.");
        return;
      }
      setCouponCode(result.code ?? couponCode.trim().toUpperCase());
      setAppliedCoupon({ code: result.code ?? couponCode.trim().toUpperCase(), discount: result.discount ?? 0, freeShipping: result.freeShipping ?? false });
    });
  }

  // Save contact details for abandoned-checkout follow-up.
  function saveContact() {
    const f = formRef.current;
    if (!f) return;
    const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
    void saveCheckoutContactAction({ name: v("name"), phone: v("phone"), email: v("email"), pincode: v("pincode") });
  }

  const payLabel = pending || payUrl ? "Placing order…" : method === "cod" ? `Place order · ${formatMoney(total)}` : `Pay ${formatMoney(total)}`;

  return (
    <form ref={formRef} action={action} onBlur={saveContact} onInput={saveDraft} onChange={saveDraft} className="mt-6 grid gap-6 pb-24 lg:grid-cols-[1fr_420px] lg:gap-8 lg:pb-0">
      <input type="hidden" name="couponCode" value={appliedCoupon?.code ?? ""} />

      <div className="space-y-5">
        <Step n={1} icon={User} title="Contact" hint="We'll send order updates on WhatsApp / SMS.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="name" autoComplete="name" required error={fe.name} />
            <Field label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile" required error={fe.phone} />
            <Field label="Email (optional)" name="email" type="email" autoComplete="email" placeholder="For the invoice" error={fe.email} className="sm:col-span-2" />
          </div>
        </Step>

        <Step n={2} icon={MapPin} title="Delivery address" hint="Enter the pincode first to see shipping and delivery time.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Pincode"
                name="pincode"
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                placeholder="6-digit pincode"
                required
                value={pincode}
                onChange={(e) => onPincode(e.target.value)}
                error={fe.pincode ?? (quote?.ok && !quote.serviceable ? "Sorry, we can't deliver to this pincode yet." : undefined)}
                className="sm:max-w-xs"
              />
              <AnimatePresence>
                {(quoting || known) && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 inline-flex items-center gap-2 rounded-full bg-forest/5 px-3 py-1.5 text-xs font-medium text-forest"
                  >
                    {quoting ? <Loader2 className="size-3.5 animate-spin" /> : <Truck className="size-3.5" />}
                    {quoting ? "Checking delivery…" : `Delivers here${quote?.ok && quote.edd ? ` in ${quote.edd}` : ""}`}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <Field label="House no., building, street" name="line1" autoComplete="address-line1" required error={fe.line1} className="sm:col-span-2" />
            <Field label="Area, landmark (optional)" name="line2" autoComplete="address-line2" className="sm:col-span-2" />
            <Field label="City" name="city" autoComplete="address-level2" required error={fe.city} />
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">State</span>
              <select name="state" required defaultValue="" autoComplete="address-level1" className={cn(field, "appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235c5a52%22 stroke-width=%222%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", fe.state && "border-alert")}>
                <option value="" disabled>
                  Select state
                </option>
                {INDIAN_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {fe.state && <span className="mt-1 block text-xs text-alert">{fe.state}</span>}
            </label>
          </div>
        </Step>

        <Step n={3} icon={CreditCard} title="Payment" hint="All payments are encrypted and processed by PayU.">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { id: "payu", title: "Pay online", note: "UPI, cards, net banking, wallets", icon: CreditCard, badges: ["UPI", "Visa", "Mastercard", "RuPay"], show: true },
                { id: "cod", title: "Cash on delivery", note: codFee ? `${formatMoney(codFee)} COD charge applies` : "Pay when your order arrives", icon: Banknote, badges: [], show: codAllowed },
              ] as const
            )
              .filter((m) => m.show)
              .map((m) => {
                const on = method === m.id;
                const I = m.icon;
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-4 transition-all",
                      on ? "border-forest bg-forest/[0.03] shadow-[0_10px_24px_-18px_rgba(7,47,27,0.6)]" : "border-line hover:border-forest/30",
                    )}
                  >
                    <input type="radio" name="method" value={m.id} checked={on} onChange={() => setMethod(m.id)} className="sr-only" />
                    <span className="flex items-center gap-3">
                      <span className={cn("grid size-10 place-items-center rounded-xl", on ? "bg-forest text-white" : "bg-khaki-soft text-forest")}>
                        <I className="size-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold text-forest-text">{m.title}</span>
                        <span className="block text-xs text-ink-muted">{m.note}</span>
                      </span>
                      <span className={cn("grid size-5 place-items-center rounded-full border-2", on ? "border-forest bg-forest text-white" : "border-line")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                    </span>
                    {m.badges.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {m.badges.map((b) => (
                          <span key={b} className="rounded-md border border-line bg-white px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink-muted">
                            {b}
                          </span>
                        ))}
                      </span>
                    )}
                  </label>
                );
              })}
          </div>
          {!codAllowed && ship.codEnabled && <p className="mt-3 text-xs text-ink-muted">Cash on delivery isn&apos;t available for this order or pincode.</p>}
          {fe.method && <p className="mt-2 text-xs text-alert">{fe.method}</p>}
        </Step>
      </div>

      {/* Summary */}
      <aside className="h-fit lg:sticky lg:top-[calc(var(--sticky-top,120px)+16px)]">
        <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg">Order summary</h2>
            <span className="rounded-full bg-khaki-soft px-2.5 py-0.5 text-xs font-semibold text-forest-text">
              {items} item{items === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="max-h-[300px] divide-y divide-line overflow-y-auto px-5" data-lenis-prevent="">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <span className="relative grid size-16 shrink-0 place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_60%,#f3e6c8,#f6efe2_70%)]">
                  {l.image && <Image src={l.image.url} alt={l.image.alt} width={64} height={64} className="size-14 object-contain" />}
                  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-forest text-[10px] font-bold text-white">{l.quantity}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{shortTitle(l.title)}</span>
                  <span className="block text-xs text-ink-muted">{l.variant}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(l.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-line px-5 py-4">
            {appliedCoupon ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-forest/40 bg-forest/5 px-3 py-2.5">
                <TicketPercent className="size-4 text-forest" />
                <span className="flex-1 text-sm">
                  <span className="font-bold text-forest">{appliedCoupon.code}</span> applied
                  {appliedCoupon.discount > 0 && <span className="text-ink-muted"> · you save {formatMoney(appliedCoupon.discount)}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponCode("");
                    setCouponError("");
                  }}
                  className="grid size-7 place-items-center rounded-full text-ink-muted hover:bg-white"
                  aria-label="Remove coupon"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <span className="sr-only">Coupon code</span>
                  <TicketPercent className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    id="coupon-code"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (couponCode.trim()) applyCoupon();
                      }
                    }}
                    placeholder="Coupon code"
                    autoComplete="off"
                    className={cn(field, "h-11 pl-10 font-mono text-sm tracking-wide uppercase")}
                  />
                </label>
                <button
                  type="button"
                  disabled={couponPending || !couponCode.trim()}
                  onClick={applyCoupon}
                  className="h-11 rounded-xl border border-forest px-4 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-white disabled:opacity-40"
                >
                  {couponPending ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </button>
              </div>
            )}
            {couponError && (
              <p role="alert" className="mt-2 text-xs text-alert">
                {couponError}
              </p>
            )}
          </div>

          <dl className="space-y-2.5 border-t border-line px-5 py-4 text-sm">
            <Row label="Subtotal" value={formatMoney(subtotal)} />
            {appliedCoupon && appliedCoupon.discount > 0 && <Row label="Coupon discount" value={`−${formatMoney(appliedCoupon.discount)}`} accent />}
            <Row
              label="Shipping"
              value={quoting ? "Checking…" : finalShipping === null ? "Enter pincode" : finalShipping ? formatMoney(finalShipping) : "Free"}
              accent={finalShipping === 0}
            />
            {codFee > 0 && <Row label="COD charge" value={formatMoney(codFee)} />}
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="text-right">
                <span className="text-2xl font-extrabold text-forest tabular-nums">{formatMoney(total)}</span>
                <span className="block text-[10px] tracking-wide text-ink-muted uppercase">Inclusive of all taxes</span>
              </dd>
            </div>
          </dl>

          {subtotal < ship.freeShippingThreshold && !appliedCoupon?.freeShipping && (
            <p className="mx-5 mb-4 flex items-center gap-2 rounded-xl bg-khaki-soft px-3 py-2 text-xs text-forest-text">
              <Truck className="size-4 shrink-0 text-forest" /> Add {formatMoney(ship.freeShippingThreshold - subtotal)} more for free shipping.
            </p>
          )}

          <div className="hidden border-t border-line p-5 lg:block">
            {state?.error && (
              <p role="alert" className="mb-3 rounded-xl bg-alert-soft p-3 text-sm text-alert">
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending || !!payUrl || blocked}
              className="btn-shine checkout-glow inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-forest text-base font-bold text-white transition-colors hover:bg-forest-mid disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
              {payLabel}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
              <ShieldCheck className="size-3.5 text-forest" /> 100% secure checkout · SSL encrypted
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile sticky pay bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {state?.error && (
          <p role="alert" className="mb-2 text-xs text-alert">
            {state.error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-ink-muted">Total</p>
            <p className="text-lg font-extrabold text-forest tabular-nums">{formatMoney(total)}</p>
          </div>
          <button
            type="submit"
            disabled={pending || !!payUrl || blocked}
            className="btn-shine inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-forest text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {method === "cod" ? "Place order" : "Pay securely"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("tabular-nums", accent ? "font-semibold text-forest" : "text-ink")}>{value}</dd>
    </div>
  );
}
