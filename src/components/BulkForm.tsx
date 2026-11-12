"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CheckCircle2, MessageCircle } from "@/components/icons/duo";
import { cn } from "@/lib/utils/cn";
import { whatsappLink } from "@/data/site";
import { submitBulkInquiryAction } from "@/lib/inquiry-actions";

const fieldClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] font-normal text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10";
const labelClass = "grid gap-1.5 text-[13px] font-medium text-ink-muted";
const QTY = ["2 × 15 L tins", "5 × 15 L tins", "10 × 15 L tins", "Monthly supply"];

export function BulkForm({ products }: { products: string[] }) {
  const [values, setValues] = useState({
    name: "",
    business: "",
    city: "",
    product: products[0] ?? "",
    quantity: "",
    phone: "",
    email: "",
    message: "",
    website: "",
  });
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [done, setDone] = useState(false);

  const set =
    (key: keyof typeof values) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = [
      "Bulk order inquiry",
      `Name: ${values.name}`,
      `Business: ${values.business}`,
      `City: ${values.city}`,
      `Product: ${values.product}`,
      `Quantity: ${values.quantity}`,
      `Phone: ${values.phone}`,
      values.email ? `Email: ${values.email}` : "",
      values.message ? `Message: ${values.message}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const url = whatsappLink(message);
    const popup = window.open("about:blank", "_blank");
    setFallbackUrl(url);
    setPending(true);
    setFeedback("");
    const result = await submitBulkInquiryAction(values);
    if (popup) {
      popup.opener = null;
      popup.location.href = url;
    }
    setPending(false);
    if (result.ok) setDone(true);
    else setFeedback(`${result.error ?? "Could not save the inquiry."} You can still continue in WhatsApp.`);
  }

  if (done)
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-white p-8 text-center">
        <CheckCircle2 className="size-14 text-forest" strokeWidth={1.5} />
        <p className="mt-4 text-xl font-bold text-forest-text">Inquiry received</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">Thanks, {values.name.split(" ")[0]}. Our team will reply on WhatsApp with prices and delivery details.</p>
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-forest-mid">
          <MessageCircle className="size-4" /> Open WhatsApp again
        </a>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label
        aria-hidden="true"
        className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
      >
        Leave this field empty
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={set("website")}
        />
      </label>
      <label className={labelClass}>
        Name
        <input
          required
          className={fieldClass}
          value={values.name}
          onChange={set("name")}
          autoComplete="name"
        />
      </label>
      <label className={labelClass}>
        Business
        <input
          required
          className={fieldClass}
          value={values.business}
          onChange={set("business")}
          autoComplete="organization"
        />
      </label>
      <label className={labelClass}>
        City
        <input
          required
          className={fieldClass}
          value={values.city}
          onChange={set("city")}
          autoComplete="address-level2"
        />
      </label>
      <label className={labelClass}>
        Phone
        <input
          required
          type="tel"
          inputMode="tel"
          maxLength={15}
          placeholder="10-digit mobile number"
          className={fieldClass}
          value={values.phone}
          onChange={set("phone")}
          autoComplete="tel"
        />
      </label>
      <label className={labelClass}>
        <span>
          Email <span className="text-ink-muted/70">(optional)</span>
        </span>
        <input
          type="email"
          maxLength={160}
          className={fieldClass}
          value={values.email}
          onChange={set("email")}
          autoComplete="email"
        />
      </label>
      <label className={labelClass}>
        Product
        <select
          className={fieldClass}
          value={values.product}
          onChange={set("product")}
        >
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className={cn(labelClass, "sm:col-span-2")}>
        Quantity
        <input
          required
          className={fieldClass}
          placeholder="e.g. 10 tins of 15L"
          value={values.quantity}
          onChange={set("quantity")}
        />
        <span className="flex flex-wrap gap-1.5">
          {QTY.map((q) => (
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
      <label className={cn(labelClass, "sm:col-span-2")}>
        <span>
          Anything else we should know? <span className="text-ink-muted/70">(optional)</span>
        </span>
        <textarea
          maxLength={1000}
          rows={3}
          placeholder="Delivery city, how often you need it, packaging…"
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
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        {pending ? "Sending inquiry…" : "Send inquiry on WhatsApp"}
      </button>
      {feedback && (
        <p role="alert" className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert sm:col-span-2">
          {feedback}
        </p>
      )}
      {fallbackUrl && (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noreferrer"
          className="text-center text-sm font-semibold text-forest underline sm:col-span-2"
        >
          Continue to WhatsApp
        </a>
      )}
    </form>
  );
}
