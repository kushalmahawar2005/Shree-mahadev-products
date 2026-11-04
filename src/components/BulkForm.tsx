"use client";

import { useState } from "react";
import { whatsappLink } from "@/data/site";
import { submitBulkInquiryAction } from "@/lib/inquiry-actions";

const fieldClass =
  "h-12 w-full rounded-full border border-ink/20 bg-white px-5 text-base outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/30";

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
    setFeedback(
      result.ok
        ? "Thanks. Your inquiry has been saved and WhatsApp is opening."
        : `${result.error ?? "Could not save the inquiry."} You can still continue in WhatsApp.`,
    );
  }

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
      <label className="grid gap-1 text-sm font-medium">
        Name
        <input
          required
          className={fieldClass}
          value={values.name}
          onChange={set("name")}
          autoComplete="name"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Business
        <input
          required
          className={fieldClass}
          value={values.business}
          onChange={set("business")}
          autoComplete="organization"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        City
        <input
          required
          className={fieldClass}
          value={values.city}
          onChange={set("city")}
          autoComplete="address-level2"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
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
      <label className="grid gap-1 text-sm font-medium">
        Email <span className="font-normal text-ink-muted">(optional)</span>
        <input
          type="email"
          maxLength={160}
          className={fieldClass}
          value={values.email}
          onChange={set("email")}
          autoComplete="email"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
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
      <label className="grid gap-1 text-sm font-medium">
        Quantity
        <input
          required
          className={fieldClass}
          placeholder="e.g. 10 tins of 15L"
          value={values.quantity}
          onChange={set("quantity")}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">
        Anything else we should know?{" "}
        <span className="font-normal text-ink-muted">(optional)</span>
        <textarea
          maxLength={1000}
          rows={3}
          className="w-full rounded-2xl border border-ink/20 bg-white px-5 py-3 text-base outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/30"
          value={values.message}
          onChange={set("message")}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-full bg-forest px-6 font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-60 sm:col-span-2"
      >
        {pending ? "Saving inquiry…" : "Save inquiry & open WhatsApp"}
      </button>
      <p aria-live="polite" className="text-sm text-ink-muted sm:col-span-2">
        {feedback}
      </p>
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
