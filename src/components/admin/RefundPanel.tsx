"use client";

import { useRouter } from "next/navigation";
import { unwrap } from "@/lib/action-result";
import { useState, useTransition } from "react";
import { Loader2, MailCheck, Undo2 } from "lucide-react";
import { refundOrderAction, sendRefundOtpAction } from "@/lib/admin-actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn/input-otp";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

type Refund = { id: number; amount: number; reason: string | null; status: string; ref: string | null; error: string | null; by: string | null; at: string };

const field = "h-10 rounded-full border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15";

export function RefundPanel({ orderId, paid, left, refunds }: { orderId: number; paid: number; left: number; refunds: Refund[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(left));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // Refund approval: a code goes to the owner's inbox; the refund runs only after it is entered.
  const [otpOpen, setOtpOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const n = Number(amount);

  const sendCode = () =>
    startSend(async () => {
      setOtpError(null);
      setCode("");
      try {
        const r = unwrap(await sendRefundOtpAction(orderId, n));
        setSentTo(r.sentTo);
      } catch (e) {
        setOtpError((e as Error).message);
      }
    });

  const confirmRefund = () =>
    start(async () => {
      setOtpError(null);
      try {
        const r = unwrap(await refundOrderAction(orderId, n, reason, code));
        setOtpOpen(false);
        setMsg({ ok: true, text: `${r.full ? "Full" : "Partial"} refund of ${formatMoney(r.amount)} requested. Customer emailed.` });
        router.refresh();
      } catch (e) {
        const text = (e as Error).message;
        // A wrong code stays in the dialog; a gateway failure closes it and shows under the panel.
        if (/code/i.test(text)) setOtpError(text);
        else {
          setOtpOpen(false);
          setMsg({ ok: false, text });
          router.refresh();
        }
      }
    });
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
          <button
            type="button"
            disabled={pending || !valid}
            onClick={() => {
              setMsg(null);
              setSentTo(null);
              setOtpOpen(true);
              sendCode();
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#b91c1c] px-4 font-semibold text-white transition-colors hover:bg-[#991b1b] disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            {pending ? "Refunding…" : "Refund"}
          </button>
        </div>
      )}
      <Dialog open={otpOpen} onOpenChange={(o) => !pending && setOtpOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve refund of {formatMoney(n)}</DialogTitle>
            <DialogDescription>
              {sending
                ? "Sending an approval code to the owner's email…"
                : sentTo
                  ? `Enter the 6-digit code sent to ${sentTo}. It works for 10 minutes, for this amount only.`
                  : "We email the owner a code before any refund goes out."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <span className="grid size-12 place-items-center rounded-2xl bg-khaki-soft text-forest-fg">
              {sending ? <Loader2 className="size-5 animate-spin" /> : <MailCheck className="size-5" />}
            </span>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, ""))}
              inputMode="numeric"
              autoFocus
              disabled={!sentTo || pending}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {otpError && <p className="text-center text-sm text-red-700" role="alert">{otpError}</p>}
            <button type="button" onClick={sendCode} disabled={sending || pending} className="text-xs font-semibold text-forest-fg underline-offset-4 hover:underline disabled:opacity-50">
              {sentTo ? "Resend code" : "Send code"}
            </button>
          </div>
          <p className="text-xs text-ink-muted">
            The money goes back to the customer&apos;s original payment method through the gateway that took it (PayU or Cashfree). The customer is emailed.
          </p>
          <DialogFooter>
            <button type="button" onClick={() => setOtpOpen(false)} disabled={pending} className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-ink hover:bg-subtle">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRefund}
              disabled={code.length !== 6 || pending || sending}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#b91c1c] px-4 text-sm font-semibold text-white hover:bg-[#991b1b] disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              Verify &amp; refund {formatMoney(n)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {msg && <p className={msg.ok ? "text-forest-fg" : "text-red-700"} role="status">{msg.text}</p>}
    </div>
  );
}
