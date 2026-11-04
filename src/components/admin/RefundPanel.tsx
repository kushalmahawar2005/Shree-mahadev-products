"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refundOrderAction } from "@/lib/admin-actions";
import { formatMoney } from "@/lib/utils/money";

type Refund = { id: number; amount: number; reason: string | null; status: string; ref: string | null; error: string | null; by: string | null; at: string };

export function RefundPanel({ orderId, paid, left, refunds }: { orderId: number; paid: number; left: number; refunds: Refund[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(left));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-muted">
        Paid online {formatMoney(paid)} · refundable {formatMoney(left)}
      </p>
      {refunds.length > 0 && (
        <ul className="divide-y divide-line">
          {refunds.map((r) => (
            <li key={r.id} className="py-1.5">
              <strong>{formatMoney(r.amount)}</strong> · {r.status} · {r.at.slice(0, 16)}
              {r.by ? ` · ${r.by}` : ""}
              {r.reason ? ` · ${r.reason}` : ""}
              {r.error ? <span className="block text-sale">{r.error}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {left > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Refund amount" className="h-10 w-24 rounded-full border border-line px-3" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="h-10 min-w-40 flex-1 rounded-full border border-line px-3" />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const n = Number(amount);
              if (!window.confirm(`Refund ${formatMoney(n)} to the customer's original payment method?`)) return;
              start(async () => {
                setMsg(null);
                try {
                  const r = await refundOrderAction(orderId, n, reason);
                  setMsg({ ok: true, text: `${r.full ? "Full" : "Partial"} refund of ${formatMoney(r.amount)} requested. Customer emailed.` });
                  router.refresh();
                } catch (e) {
                  setMsg({ ok: false, text: (e as Error).message });
                }
              });
            }}
            className="h-10 rounded-full bg-red-700 px-4 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Refunding…" : "Refund"}
          </button>
        </div>
      )}
      {msg && <p className={msg.ok ? "text-forest" : "text-sale"}>{msg.text}</p>}
    </div>
  );
}
