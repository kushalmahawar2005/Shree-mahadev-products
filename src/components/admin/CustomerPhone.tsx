"use client";

import { useState } from "react";
import { Eye, EyeOff, Mail, MessageCircle, Phone } from "lucide-react";
import { CopyButton } from "./order/CopyButton";

const pill =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-forest-fg transition-colors hover:bg-khaki-soft";

/** Phone with mask toggle + quick contact actions (call, WhatsApp, email). */
export function CustomerPhone({ phone, email }: { phone: string; email?: string }) {
  const [masked, setMasked] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 pr-1 font-semibold text-ink tabular-nums">
        {masked ? `${phone.slice(0, 2)}••••••${phone.slice(-2)}` : `+91 ${phone}`}
        {!masked && <CopyButton value={phone} label="phone" />}
      </span>
      {!masked && (
        <>
          <a className={pill} href={`tel:+91${phone}`}>
            <Phone className="size-4" />
            Call
          </a>
          <a className={pill} href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" />
            WhatsApp
          </a>
          {email && (
            <a className={pill} href={`mailto:${email}`}>
              <Mail className="size-4" />
              Email
            </a>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => setMasked((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-muted hover:text-forest-fg"
      >
        {masked ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {masked ? "Show" : "Mask"}
      </button>
    </div>
  );
}
