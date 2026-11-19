"use client";

import { toMobile10 } from "@/lib/utils/phone";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  requestPhoneChangeAction,
  verifyPhoneChangeAction,
} from "@/lib/account/profile-actions";
import { formatPhone } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  DevCodeNote,
  ErrorNote,
  OtpField,
  ResponsiveModal,
  SectionCard,
  btnGhost,
  btnPrimary,
  field,
  useCountdown,
} from "./parts";

const RESEND_SECONDS = 30;

export function MobileCard({ phone, lastLogin }: { phone: string; lastLogin: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <SectionCard
      id="mobile"
      icon={Smartphone}
      title="Mobile & login"
      hint="You sign in with an OTP on this number. No password needed."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-co-panel px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Mobile number</p>
          <p className="flex flex-wrap items-center gap-2 text-lg font-bold tabular-nums text-ink">
            {formatPhone(phone)}
            <Badge tone="success">
              <BadgeCheck className="size-3.5" /> Verified
            </Badge>
          </p>
        </div>
        <button type="button" className={btnGhost} onClick={() => setOpen(true)}>
          Change number
        </button>
      </div>
      {lastLogin && <p className="mt-3 text-sm text-ink-muted">Last sign-in: {lastLogin}</p>}
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Change mobile number"
        description="We’ll send a 6-digit code to the new number to confirm it’s yours."
      >
        {/* Remount on every open so the flow always starts fresh. */}
        {open && <ChangeNumberFlow onDone={() => setOpen(false)} />}
      </ResponsiveModal>
    </SectionCard>
  );
}

function ChangeNumberFlow({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"number" | "otp">("number");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [resendsLeft, setResendsLeft] = useState(3);
  const [resendAt, setResendAt] = useState(0);
  const [pending, start] = useTransition();
  const wait = useCountdown(resendAt);

  const valid = /^[6-9]\d{9}$/.test(phone);

  const send = (isResend = false) =>
    start(async () => {
      setError("");
      const r = await requestPhoneChangeAction({ phone });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDevCode(r.devCode);
      setCode(r.devCode ?? "");
      setResendsLeft(r.resendsLeft);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setStep("otp");
      if (isResend) toast.success("New code sent");
    });

  const verify = (value = code) =>
    start(async () => {
      setError("");
      const r = await verifyPhoneChangeAction({ phone, code: value });
      if (!r.ok) {
        setError(r.error);
        setCode("");
        return;
      }
      toast.success(`Number updated to ${formatPhone(r.phone)}`, {
        description: "Use this number to sign in from now on.",
      });
      onDone();
      router.refresh();
    });

  if (step === "number")
    return (
      <form
        className="mt-2 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) send();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">New mobile number</span>
          <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base font-semibold text-ink-muted">
              +91
            </span>
            <input
              autoFocus
              value={phone}
              onChange={(e) => setPhone(toMobile10(e.target.value))}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile number"
              aria-invalid={Boolean(error) || (phone.length === 10 && !valid) || undefined}
              className={cn(field, "pl-14 tracking-wide tabular-nums")}
            />
          </span>
          {phone.length === 10 && !valid && (
            <span className="mt-1 block text-xs text-co-danger">Indian mobile numbers start with 6, 7, 8 or 9.</span>
          )}
        </label>
        <ErrorNote error={error} />
        <button type="submit" disabled={!valid || pending} className={cn(btnPrimary, "h-12 w-full")}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Send OTP
        </button>
      </form>
    );

  return (
    <form
      className="mt-2 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) verify();
      }}
    >
      <p className="text-sm text-ink-muted">
        Code sent to <span className="font-semibold text-ink tabular-nums">{formatPhone(phone)}</span>. It expires in 5 minutes.
      </p>
      <OtpField
        value={code}
        onChange={setCode}
        onComplete={(v) => verify(v)}
        disabled={pending}
        invalid={Boolean(error)}
      />
      <DevCodeNote code={devCode} />
      <ErrorNote error={error} />
      <button type="submit" disabled={code.length !== 6 || pending} className={cn(btnPrimary, "h-12 w-full")}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Verify & update
      </button>
      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-ink-muted hover:text-ink"
          onClick={() => {
            setStep("number");
            setCode("");
            setError("");
          }}
        >
          <ArrowLeft className="size-4" /> Change number
        </button>
        <span aria-live="polite">
          {resendsLeft <= 0 ? (
            <span className="text-ink-muted">No resends left</span>
          ) : wait > 0 ? (
            <span className="text-ink-muted tabular-nums">Resend in {wait}s</span>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => send(true)}
              className="inline-flex min-h-11 items-center font-semibold text-forest hover:underline disabled:opacity-50"
            >
              Resend code ({resendsLeft} left)
            </button>
          )}
        </span>
      </div>
    </form>
  );
}
