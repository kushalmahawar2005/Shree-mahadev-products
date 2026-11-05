"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvoiceBulkButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const print = () => {
    const ids = [...document.querySelectorAll<HTMLInputElement>(".invoice-order-checkbox:checked")].map((input) => input.value);
    if (!ids.length) { setMessage("Select one or more orders first."); return; }
    if (ids.length > 50) { setMessage("Print up to 50 orders at a time."); return; }
    router.push(`/admin/orders/invoice?ids=${encodeURIComponent(ids.join(","))}`);
  };
  return <div className="flex items-center gap-2">
    {message && <span role="status" className="text-sm text-sale">{message}</span>}
    <button type="button" onClick={print} className="min-h-11 rounded-full border border-forest px-4 text-sm font-semibold text-forest-fg hover:bg-khaki-soft">Print selected invoices</button>
  </div>;
}
