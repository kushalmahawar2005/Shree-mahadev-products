"use client";

import { useState } from "react";
import { whatsappLink } from "@/data/site";

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
  });

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = [
      "Bulk order inquiry",
      `Name: ${values.name}`,
      `Business: ${values.business}`,
      `City: ${values.city}`,
      `Product: ${values.product}`,
      `Quantity: ${values.quantity}`,
      `Phone: ${values.phone}`,
    ].join("\n");
    window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium">
        Name
        <input required className={fieldClass} value={values.name} onChange={set("name")} autoComplete="name" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Business
        <input required className={fieldClass} value={values.business} onChange={set("business")} autoComplete="organization" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        City
        <input required className={fieldClass} value={values.city} onChange={set("city")} autoComplete="address-level2" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Phone
        <input required type="tel" inputMode="tel" className={fieldClass} value={values.phone} onChange={set("phone")} autoComplete="tel" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Product
        <select className={fieldClass} value={values.product} onChange={set("product")}>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Quantity
        <input required className={fieldClass} placeholder="e.g. 10 tins of 15L" value={values.quantity} onChange={set("quantity")} />
      </label>
      <button
        type="submit"
        className="h-12 rounded-full bg-forest px-6 font-semibold text-white transition-colors hover:bg-forest-mid sm:col-span-2"
      >
        Send on WhatsApp
      </button>
    </form>
  );
}
