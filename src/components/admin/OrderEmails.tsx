"use client";

import { useState, useTransition } from "react";
import { resendOrderEmailAction } from "@/lib/admin-actions";
import type { OutboxRow } from "@/lib/server/mail";
import { cn } from "@/lib/utils/cn";

const LABEL: Record<string, string> = {
  order_placed: "Order placed (COD)",
  payment_received: "Payment received",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refund: "Refund processed",
  store_new_order: "Store alert",
};
const TONE: Record<string, string> = { sent: "bg-forest/10 text-forest", pending: "bg-mustard/20 text-sale", sending: "bg-mustard/20 text-sale", failed: "bg-red-100 text-red-800" };

export function OrderEmails({ orderId, initial, hasEmail, configured }: { orderId: number; initial: OutboxRow[]; hasEmail: boolean; configured: boolean }) {
  const [rows, setRows] = useState(initial);
  const [kind, setKind] = useState("order_placed");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 text-sm">
      {!configured && <p className="rounded-xl bg-mustard/15 p-3 text-sale">Email sending is off (RESEND_API_KEY not set). Messages wait here and go out once it is added.</p>}
      {!hasEmail && <p className="text-ink-muted">Customer didn&apos;t give an email. Only store alerts are sent.</p>}
      {rows.length === 0 ? (
        <p className="text-ink-muted">No emails yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{LABEL[r.template] ?? r.template}</span>
                <span className="block truncate text-ink-muted">
                  {r.to} · {(r.sentAt ?? r.createdAt).slice(0, 16)}
                  {r.error && r.status !== "sent" ? ` · ${r.error}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", TONE[r.status])}>{r.status}</span>
                <a href={`/admin/emails/preview?id=${r.id}`} target="_blank" rel="noreferrer" className="text-forest underline">
                  Preview
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-full border border-line px-3" aria-label="Email to send">
          {Object.entries(LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(null);
              try {
                setRows(await resendOrderEmailAction(orderId, kind));
              } catch (e) {
                setErr((e as Error).message);
              }
            })
          }
          className="h-10 rounded-full bg-forest px-4 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Resend email"}
        </button>
        {err && <span className="text-sale">{err}</span>}
      </div>
    </div>
  );
}
