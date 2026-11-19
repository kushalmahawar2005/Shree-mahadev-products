"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, PhoneCall } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { submitSupportTicketAction } from "@/lib/account/support-actions";
import { supportConfig } from "@/config/support";
import { cn } from "@/lib/utils/cn";

/**
 * Amazon-style "Request a call back": pick a time, optional note, done. Saved as a help ticket
 * (issue "callback", contact by call), so the team gets the email alert and sees it in Admin → Helpdesk,
 * then calls the customer on their account number.
 */
export function RequestCallback({
  orderId = null,
  orderNo,
  phone,
  className,
}: {
  orderId?: number | null;
  orderNo?: string;
  phone: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string>(supportConfig.callbackSlots[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await submitSupportTicketAction({
        orderId,
        issue: "callback",
        message: note.trim(),
        contactPref: "call",
        callbackSlot: slot,
        photos: [],
      });
      if (r.ok) setDone(r.ticket.ticketNo);
      else setError(r.error);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setDone(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "btn-shine inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest px-5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-mid",
            className,
          )}
        >
          <PhoneCall className="size-4 shrink-0" /> Request a call back
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl">
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-12 text-co-success" />
            <DialogTitle className="mt-3 text-xl">We&apos;ll call you</DialogTitle>
            <DialogDescription className="mt-1.5">
              Our team will call <b className="text-ink">{phone}</b> between {slot}. Request {done}.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogTitle className="text-xl">Request a call back</DialogTitle>
            <DialogDescription>
              We&apos;ll call you on <b className="text-ink">{phone}</b>
              {orderNo ? <> about order #{orderNo}</> : null}. Pick a time that suits you.
            </DialogDescription>
            <div role="radiogroup" aria-label="Call time" className="mt-2 grid grid-cols-2 gap-2">
              {supportConfig.callbackSlots.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={slot === s}
                  onClick={() => setSlot(s)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium transition-colors",
                    slot === s ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-forest/40",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={supportConfig.messageMax}
              rows={3}
              placeholder="What's it about? (optional)"
              className="mt-1 w-full resize-none rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-forest"
            />
            {error && <p className="text-sm text-sale">{error}</p>}
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest text-base font-semibold text-white hover:bg-forest-mid disabled:opacity-70"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />} Call me back
            </button>
            <p className="text-center text-xs text-ink-muted">We call between 9am and 6pm, within the slot you pick.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
