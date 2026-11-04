"use client";

import { useState } from "react";

export function CustomerPhone({ phone }: { phone: string }) {
  const [masked, setMasked] = useState(false);
  const display = masked
    ? `${phone.slice(0, 2)}••••••${phone.slice(-2)}`
    : `+91 ${phone}`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-semibold">{display}</span>
      <button
        type="button"
        onClick={() => setMasked((value) => !value)}
        className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold hover:border-forest"
      >
        {masked ? "Show phone" : "Mask phone"}
      </button>
      {!masked && (
        <>
          <a
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-forest"
            href={`tel:+91${phone}`}
          >
            Call
          </a>
          <a
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-forest"
            href={`https://wa.me/91${phone}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </>
      )}
    </div>
  );
}
