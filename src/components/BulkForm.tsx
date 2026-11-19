"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { CheckCircle2 } from "@/components/icons/duo";
import { cn } from "@/lib/utils/cn";
import { submitBulkInquiryAction } from "@/lib/inquiry-actions";
import { toMobile10 } from "@/lib/utils/phone";

const fieldClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] font-normal text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10";
const labelClass = "grid gap-1.5 text-[13px] font-medium text-ink-muted";

/** What kind of bulk order it is. Saved at the top of the message so the team sees it first. */
const NEEDS = [
  { id: "bottles", label: "Retail bottles", hint: "500 ml / 1 L packs" },
  { id: "tins", label: "Tins", hint: "5 L / 15 L" },
  { id: "private", label: "Private / white label", hint: "Your brand sticker" },
  { id: "jars", label: "Honey & jaggery", hint: "Jars, packs, loose" },
  { id: "gifting", label: "Gifting / events", hint: "Corporate, weddings" },
  { id: "regular", label: "Regular supply", hint: "Weekly or monthly" },
] as const;
const QTY = ["50 bottles", "100+ bottles", "5 × 15 L tins", "10 × 15 L tins", "Monthly supply"];

export type BulkProductGroup = { label: string; items: string[] };

export function BulkForm({ groups }: { groups: BulkProductGroup[] }) {
  // Sent here from the cart / product page when an order is over the per-order limit:
  // ?product=Groundnut Oil&size=1 L&max=12 → that product ticked and quick picks above the limit.
  const params = useSearchParams();
  const fromProduct = (params.get("product") ?? "").trim().slice(0, 80);
  const fromSize = (params.get("size") ?? "").trim().slice(0, 20);
  const fromMax = Math.min(10_000, Math.max(0, Number.parseInt(params.get("max") ?? "", 10) || 0));
  const limited = Boolean(fromSize && fromMax);
  const quick = limited ? [2, 3, 5].map((m) => `${fromMax * m} × ${fromSize}`).concat("Monthly supply") : QTY;
  const known = groups.some((g) => g.items.includes(fromProduct));
  const allGroups = fromProduct && !known ? [{ label: "Selected", items: [fromProduct] }, ...groups] : groups;

  const [values, setValues] = useState({ name: "", business: "", city: "", quantity: "", phone: "", email: "", message: "", website: "" });
  const [picked, setPicked] = useState<string[]>(fromProduct ? [fromProduct] : []);
  // Coming from a limit note on a bottle size: they most likely want more of the same retail packs.
  const [needs, setNeeds] = useState<string[]>(limited ? [/l$|ml$/i.test(fromSize) && !/^(5|15) ?l$/i.test(fromSize) ? "bottles" : "tins"] : []);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked.length) return setFeedback("Tick at least one product.");
    const needLine = needs.length ? `Looking for: ${NEEDS.filter((n) => needs.includes(n.id)).map((n) => n.label).join(", ")}` : "";
    const message = [needLine, values.message.trim()].filter(Boolean).join("\n\n").slice(0, 1000);
    setPending(true);
    setFeedback("");
    const result = await submitBulkInquiryAction({ ...values, message, product: picked.join(", ") });
    setPending(false);
    if (result.ok) setDone(true);
    else setFeedback(result.error ?? "Could not save the inquiry. Please try again in a minute.");
  }

  if (done)
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-co-brand-soft/60 p-8 text-center">
        <CheckCircle2 className="size-14 text-forest" strokeWidth={1.5} />
        <p className="mt-4 text-xl font-bold text-forest-text">Inquiry received</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Thanks, {values.name.split(" ")[0]}. Our team will call you on {values.phone} with prices, MOQ and delivery details within a working day.
        </p>
      </div>
    );

  const step = (n: number, title: string, hint?: string) => (
    <p className="flex items-baseline gap-2 text-sm font-semibold text-forest-text sm:col-span-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-forest text-[11px] text-white">{n}</span>
      {title}
      {hint && <span className="text-xs font-normal text-ink-muted">{hint}</span>}
    </p>
  );

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label aria-hidden="true" className="absolute top-auto -left-[10000px] h-px w-px overflow-hidden">
        Leave this field empty
        <input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
      </label>

      {step(1, "What do you need?", "(pick all that apply)")}
      <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-3">
        {NEEDS.map((n) => {
          const on = needs.includes(n.id);
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={on}
              onClick={() => setNeeds((l) => toggle(l, n.id))}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                on ? "border-forest bg-co-brand-soft" : "border-line bg-white hover:border-forest/40",
              )}
            >
              <span className={cn("block text-sm font-semibold", on ? "text-forest-text" : "text-ink")}>{n.label}</span>
              <span className="block text-[11.5px] text-ink-muted">{n.hint}</span>
            </button>
          );
        })}
      </div>

      {step(2, "Which products?", picked.length ? `${picked.length} selected` : "(tick all you need)")}
      <div className="space-y-3 sm:col-span-2">
        {allGroups.map((g) => (
          <fieldset key={g.label}>
            <legend className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{g.label}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {g.items.map((p) => {
                const on = picked.includes(p);
                return (
                  <label
                    key={p}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm font-medium transition-colors",
                      on ? "border-forest bg-co-brand-soft text-forest-text" : "border-line bg-white text-ink hover:border-forest/40",
                    )}
                  >
                    <input type="checkbox" checked={on} onChange={() => setPicked((l) => toggle(l, p))} className="size-4 shrink-0 accent-[#0e3b26]" />
                    <span className="min-w-0 leading-tight">{p}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <label className={cn(labelClass, "sm:col-span-2")}>
        <span>
          Quantity
          {limited && (
            <span className="ml-1.5 font-normal text-ink-muted/80">
              (online orders take up to {fromMax} × {fromSize}; tell us how many you need)
            </span>
          )}
        </span>
        <input
          required
          maxLength={60}
          className={fieldClass}
          placeholder={limited ? `e.g. ${fromMax * 2} × ${fromSize}` : "e.g. 200 bottles of 1 L, or 10 tins of 15 L"}
          value={values.quantity}
          onChange={set("quantity")}
        />
        <span className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setValues((v) => ({ ...v, quantity: q }))}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                values.quantity === q ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted hover:border-forest/40 hover:text-forest",
              )}
            >
              {q}
            </button>
          ))}
        </span>
      </label>

      {step(3, "Your details")}
      <label className={labelClass}>
        Name
        <input required className={fieldClass} value={values.name} onChange={set("name")} autoComplete="name" />
      </label>
      <label className={labelClass}>
        <span>
          Business / brand <span className="text-ink-muted/70">(optional)</span>
        </span>
        <input className={fieldClass} value={values.business} onChange={set("business")} autoComplete="organization" />
      </label>
      <label className={labelClass}>
        Phone
        <input
          required
          type="tel"
          inputMode="tel"
          maxLength={16}
          placeholder="10-digit mobile number"
          className={fieldClass}
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: toMobile10(e.target.value) }))}
          autoComplete="tel"
        />
      </label>
      <label className={labelClass}>
        Delivery city
        <input required className={fieldClass} value={values.city} onChange={set("city")} autoComplete="address-level2" />
      </label>
      <label className={cn(labelClass, "sm:col-span-2")}>
        <span>
          Email <span className="text-ink-muted/70">(optional, for a written quote)</span>
        </span>
        <input type="email" maxLength={160} className={fieldClass} value={values.email} onChange={set("email")} autoComplete="email" />
      </label>
      <label className={cn(labelClass, "sm:col-span-2")}>
        <span>
          Anything else? <span className="text-ink-muted/70">(optional)</span>
        </span>
        <textarea
          maxLength={900}
          rows={4}
          placeholder="Pack sizes, how often you need it, your brand sticker, delivery timeline, questions about MOQ or pricing…"
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] font-normal text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10"
          value={values.message}
          onChange={set("message")}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-shine inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-6 text-sm font-bold text-white transition-colors hover:bg-forest-mid disabled:opacity-60 sm:col-span-2"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {pending ? "Sending inquiry…" : "Send inquiry"}
      </button>
      {feedback && (
        <p role="alert" className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert sm:col-span-2">
          {feedback}
        </p>
      )}
    </form>
  );
}
