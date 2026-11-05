"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Banknote, CreditCard, Loader2, RefreshCw, Wallet } from "lucide-react";
import { verifyPaymentAction } from "@/lib/admin-actions";
import type { PaymentAttempt } from "@/lib/server/order-detail";
import type { OrderStatus, PaymentMethod } from "@/lib/server/orders";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { CopyButton } from "./CopyButton";

const ATTEMPT_TONE: Record<string, string> = {
  success: "bg-forest/10 text-forest-fg",
  refunded: "bg-ink/[0.07] text-ink-muted",
  failed: "bg-red-100 text-red-800",
  pending: "bg-warm-strong text-sale",
  initiated: "bg-warm-strong text-sale",
};
const ATTEMPT_LABEL: Record<string, string> = {
  success: "Captured",
  refunded: "Refunded",
  failed: "Failed",
  pending: "Pending at PayU",
  initiated: "Started, not completed",
};
const MODE: Record<string, string> = { UPI: "UPI", CC: "Credit card", DC: "Debit card", NB: "Net banking", CASH: "Wallet", EMI: "EMI", reconciled: "Confirmed via PayU check" };

const VERIFY_MSG = {
  paid: "PayU confirmed the payment. The order is now paid.",
  failed: "PayU reports this attempt failed. The order stays unpaid.",
  pending: "PayU hasn't settled this payment yet. Try again in a few minutes.",
  none: "There is no open payment attempt to check.",
};

const fmt = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d.replace(" ", "T") + "+05:30"));

/** Payment state for an order: method, outcome, every PayU attempt, and a live "Check with PayU". */
export function PaymentPanel({
  orderId,
  method,
  status,
  total,
  attempts,
}: {
  orderId: number;
  method: PaymentMethod;
  status: OrderStatus;
  total: number;
  attempts: PaymentAttempt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const success = attempts.find((a) => a.status === "success" || a.status === "refunded");
  const open = attempts.find((a) => a.status === "initiated" || a.status === "pending");

  const summary =
    method === "cod"
      ? status === "delivered"
        ? { tone: "green", title: "Cash collected on delivery", text: `${formatMoney(total)} collected by the courier.` }
        : ["cancelled", "rto"].includes(status)
          ? { tone: "gray", title: "No payment due", text: "COD order didn't go through." }
          : { tone: "amber", title: "Collect on delivery", text: `Courier collects ${formatMoney(total)} in cash or UPI at the door.` }
      : method === "offline"
        ? { tone: "green", title: "Paid offline", text: `${formatMoney(total)} recorded as received outside the website.` }
        : success
          ? { tone: "green", title: "Paid online", text: `${formatMoney(success.amount)} captured by PayU${success.mode ? ` via ${MODE[success.mode] ?? success.mode}` : ""}.` }
          : open
            ? { tone: "amber", title: "Waiting for payment", text: "Customer started PayU checkout but no payment is confirmed yet." }
            : { tone: "red", title: "Not paid", text: "No successful payment on this order." };

  const Icon = method === "cod" ? Banknote : method === "offline" ? Wallet : CreditCard;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl p-4",
          summary.tone === "green" ? "bg-forest/10" : summary.tone === "amber" ? "bg-warm ring-1 ring-warm-line" : summary.tone === "red" ? "bg-red-50" : "bg-subtle",
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-forest-fg">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-forest-text">{summary.title}</p>
          <p className="text-sm text-ink-muted">{summary.text}</p>
        </div>
        {method === "payu" && open && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMsg(null);
                try {
                  const outcome = await verifyPaymentAction(orderId);
                  setMsg(VERIFY_MSG[outcome]);
                  router.refresh();
                } catch (e) {
                  setMsg((e as Error).message || "Couldn't reach PayU");
                }
              })
            }
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-forest-text transition-colors hover:border-forest"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Check with PayU
          </button>
        )}
      </div>
      {msg && <p className="rounded-xl bg-subtle px-3 py-2 text-sm text-ink" role="status">{msg}</p>}

      {method === "payu" && attempts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-muted">PayU attempts ({attempts.length})</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-mono text-xs text-ink">
                    {a.txnid}
                    <CopyButton value={a.txnid} label="transaction ID" />
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {fmt(a.createdAt)}
                    {a.mode ? ` · ${MODE[a.mode] ?? a.mode}` : ""}
                    {a.mihpayid ? ` · PayU ID ${a.mihpayid}` : ""}
                  </span>
                  {a.error && a.status !== "success" && <span className="block text-xs text-red-700">{a.error}</span>}
                </span>
                <span className="font-semibold tabular-nums text-forest-text">{formatMoney(a.amount)}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ATTEMPT_TONE[a.status] ?? ATTEMPT_TONE.pending)}>
                  {ATTEMPT_LABEL[a.status] ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {method === "payu" && attempts.length === 0 && <p className="text-sm text-ink-muted">Customer never reached the PayU page.</p>}
    </div>
  );
}
