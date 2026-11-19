"use client";

import { useRouter } from "next/navigation";
import { unwrap } from "@/lib/action-result";
import { useState, useTransition } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { refundOrderAction } from "@/lib/admin-actions";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { ConfirmAction } from "./order/ConfirmAction";

type Refund = { id: number; amount: number; reason: string | null; status: string; ref: string | null; error: string | null; by: string | null; at: string };

const field = "h-10 rounded-full border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15";

export function RefundPanel({ orderId, paid, left, refunds }: { orderId: number; paid: number; left: number; refunds: Refund[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(left));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0 && n <= left;

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <div className="bg-surface px-4 py-3">
          <p className="text-xs text-ink-muted">Paid online</p>
          <p className="font-semibold tabular-nums text-ink">{formatMoney(paid)}</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-xs text-ink-muted">Still refundable</p>
          <p className="font-semibold tabular-nums text-ink">{formatMoney(left)}</p>
        </div>
      </div>
      {refunds.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="min-w-0">
                <span className="font-semibold tabular-nums text-ink">{formatMoney(r.amount)}</span>
                <span className="block text-xs text-ink-muted">
                  {r.at.slice(0, 16)}
                  {r.by ? ` · ${r.by}` : ""}
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
                {r.error && <span className="block text-xs text-red-700">{r.error}</span>}
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", r.status === "success" ? "bg-forest/10 text-forest-fg" : r.status === "failed" ? "bg-red-100 text-red-800" : "bg-warm-strong text-sale")}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      {left > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">₹</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Refund amount" className={cn(field, "w-28 pl-7")} />
          </span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={200} className={cn(field, "min-w-40 flex-1")} />
          <ConfirmAction
            trigger={
              <button type="button" disabled={pending || !valid} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#b91c1c] px-4 font-semibold text-white transition-colors hover:bg-[#991b1b] disabled:opacity-50">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                {pending ? "Refunding…" : "Refund"}
              </button>
            }
            title={`Refund ${formatMoney(n)}?`}
            description="The money goes back to the customer's original payment method through the gateway that took it (PayU or Cashfree). The customer is emailed."
            confirmLabel="Refund now"
            destructive
            onConfirm={() =>
              start(async () => {
                setMsg(null);
                try {
                  const r = unwrap(await refundOrderAction(orderId, n, reason));
                  setMsg({ ok: true, text: `${r.full ? "Full" : "Partial"} refund of ${formatMoney(r.amount)} requested. Customer emailed.` });
                  router.refresh();
                } catch (e) {
                  setMsg({ ok: false, text: (e as Error).message });
                }
              })
            }
          />
        </div>
      )}
      {msg && <p className={msg.ok ? "text-forest-fg" : "text-red-700"} role="status">{msg.text}</p>}
    </div>
  );
}
