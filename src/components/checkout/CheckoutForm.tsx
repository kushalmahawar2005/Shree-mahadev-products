"use client";

import Image from "next/image";
import { useActionState, useRef, useState, useTransition } from "react";
import { site } from "@/data/site";
import { INDIAN_STATES } from "@/lib/checkout";
import {
  placeOrderAction,
  quoteShippingAction,
  saveCheckoutContactAction,
  type CheckoutState,
  type ShippingQuoteResult,
} from "@/lib/checkout-actions";
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
  "min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base text-ink placeholder:text-ink-muted/70 focus:border-forest focus:outline-none";

function Field({
  label,
  name,
  error,
  className,
  ...props
}: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-forest-text">{label}</span>
      <input name={name} className={cn(field, error && "border-sale")} aria-invalid={!!error} {...props} />
      {error && <span className="mt-1 block text-sm text-sale">{error}</span>}
    </label>
  );
}

export function CheckoutForm({ lines, subtotal }: { lines: Line[]; subtotal: number }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, undefined);
  const [chosenMethod, setMethod] = useState<"payu" | "cod">("payu");
  const [pincode, setPincode] = useState("");
  const [quote, setQuote] = useState<ShippingQuoteResult | null>(null);
  const [quoting, startQuote] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors ?? {};

  function onPincode(value: string) {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    setPincode(pin);
    setQuote(null);
    // Cheapest courier for this pincode (the server re-quotes on submit).
    if (/^[1-9]\d{5}$/.test(pin)) startQuote(async () => setQuote(await quoteShippingAction(pin)));
  }

  const codBlocked = quote?.ok === true && quote.cod.shipping < 0;
  const method = codBlocked ? "payu" : chosenMethod;

  const known = quote?.ok && quote.serviceable;
  const shipping = known ? (method === "cod" ? quote.cod.shipping : quote.payu.shipping) : null;
  const codFee = known && method === "cod" ? quote.cod.codFee : 0;
  const total = subtotal + (shipping ?? 0) + codFee;

  // Save contact details for abandoned-checkout follow-up.
  function saveContact() {
    const f = formRef.current;
    if (!f) return;
    const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
    void saveCheckoutContactAction({ name: v("name"), phone: v("phone"), email: v("email"), pincode: v("pincode") });
  }

  return (
    <form ref={formRef} action={action} onBlur={saveContact} className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl">Contact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="name" autoComplete="name" required error={fe.name} />
            <Field label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile" required error={fe.phone} />
            <Field label="Email" name="email" type="email" autoComplete="email" required error={fe.email} className="sm:col-span-2" />
          </div>
        </section>

        <section>
          <h2 className="text-2xl">Delivery address</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="House no., street" name="line1" autoComplete="address-line1" required error={fe.line1} className="sm:col-span-2" />
            <Field label="Area, landmark (optional)" name="line2" autoComplete="address-line2" className="sm:col-span-2" />
            <Field label="City" name="city" autoComplete="address-level2" required error={fe.city} />
            <Field
              label="Pincode"
              name="pincode"
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              required
              value={pincode}
              onChange={(e) => onPincode(e.target.value)}
              error={fe.pincode ?? (quote?.ok && !quote.serviceable ? "Sorry, we can't deliver to this pincode yet." : undefined)}
            />
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-forest-text">State</span>
              <select name="state" required defaultValue="" autoComplete="address-level1" className={cn(field, fe.state && "border-sale")}>
                <option value="" disabled>
                  Select state
                </option>
                {INDIAN_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {fe.state && <span className="mt-1 block text-sm text-sale">{fe.state}</span>}
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-2xl">Payment</h2>
          <div className="mt-4 grid gap-3">
            {(
              [
                { id: "payu", title: "Pay online", note: "UPI, cards, net banking, wallets. Secured by PayU." },
                ...(site.codAvailable && !codBlocked
                  ? [{ id: "cod", title: "Cash on delivery", note: codFee ? `${formatMoney(codFee)} COD charge applies.` : "Pay when your order arrives." }]
                  : []),
              ] as const
            ).map((m) => (
              <label
                key={m.id}
                className={cn(
                  "flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  method === m.id ? "border-forest bg-khaki-soft" : "border-line hover:border-forest/40",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={method === m.id}
                  onChange={() => setMethod(m.id as "payu" | "cod")}
                  className="mt-1 size-4 accent-forest"
                />
                <span>
                  <span className="block font-semibold text-forest-text">{m.title}</span>
                  <span className="block text-sm text-ink-muted">{m.note}</span>
                </span>
              </label>
            ))}
            {fe.method && <span className="text-sm text-sale">{fe.method}</span>}
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-2xl bg-khaki-soft p-5 md:p-6 lg:sticky lg:top-28">
        <h2 className="text-2xl">Your order</h2>
        <ul className="mt-4 divide-y divide-line">
          {lines.map((l) => (
            <li key={l.id} className="flex gap-3 py-3">
              {l.image && (
                <Image src={l.image.url} alt={l.image.alt} width={64} height={64} className="size-16 shrink-0 rounded-xl bg-white object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-forest-text">{l.title}</p>
                <p className="text-sm text-ink-muted">
                  {l.variant} × {l.quantity}
                </p>
              </div>
              <p className="font-semibold">{formatMoney(l.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4">
          <Row label="Subtotal" value={formatMoney(subtotal)} />
          <Row
            label="Shipping"
            value={quoting ? "Checking…" : shipping === null ? "Enter pincode" : shipping ? formatMoney(shipping) : "Free"}
          />
          {codFee > 0 && <Row label="COD charge" value={formatMoney(codFee)} />}
          <div className="flex items-center justify-between border-t border-line pt-3 text-lg">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold text-forest-text">{formatMoney(total)}</dd>
          </div>
        </dl>
        {subtotal < site.freeShippingThreshold && (
          <p className="mt-2 text-sm text-ink-muted">
            Add {formatMoney(site.freeShippingThreshold - subtotal)} more for free shipping.
          </p>
        )}
        {known && quote.edd && <p className="mt-1 text-sm text-ink-muted">Estimated delivery: {quote.edd}</p>}
        {state?.error && (
          <p role="alert" className="mt-4 rounded-xl bg-white p-3 text-sm text-sale">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || (quote?.ok === true && !quote.serviceable)}
          className="mt-5 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-forest px-6 text-lg font-semibold text-white transition-colors duration-200 hover:bg-forest-mid disabled:opacity-60"
        >
          {pending ? "Placing order…" : method === "cod" ? "Place order" : `Pay ${formatMoney(total)}`}
        </button>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-ink">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
