"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn/input-otp";
import { attachEmailAction, requestEmailOtpAction } from "@/lib/customer-email-login-actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Signed in (usually with WhatsApp) but no email on the account: add one with an emailed code.
 * After that the same account can also be opened with "Log in with Email", never a second account.
 */
export function AddEmailPrompt() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError("");
      const r = await requestEmailOtpAction({ email });
      if (!r.ok) return setError(r.error);
      const dev = "devCode" in r ? (r.devCode ?? "") : "";
      setDevCode(dev);
      setCode(dev);
      setSent(true);
    });
  const confirm = () =>
    start(async () => {
      setError("");
      const r = await attachEmailAction({ email, code });
      if (!r.ok) return setError(r.error);
      router.refresh();
    });

  return (
    <form
      onSubmit={(e) => (e.preventDefault(), sent ? confirm() : send())}
      className="mb-5 rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-khaki-soft text-forest">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{sent ? "Enter the code" : "Add your email"}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {sent ? (
              <>
                Sent to <span className="font-semibold break-all text-ink">{email}</span>.{" "}
                <button type="button" onClick={() => (setSent(false), setCode(""), setError(""))} className="font-semibold text-forest underline-offset-2 hover:underline">
                  Change
                </button>
              </>
            ) : (
              "Get invoices by email and log in with email too, into this same account."
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {sent ? (
          <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v.replace(/\D/g, ""))} containerClassName="flex-1" autoFocus>
            <InputOTPGroup className="gap-1.5">
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot key={i} index={i} className="size-11 rounded-xl border border-line text-base first:rounded-xl last:rounded-xl data-[active=true]:border-forest" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        ) : (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            aria-label="Email address"
            maxLength={160}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10"
          />
        )}
        <button
          type="submit"
          disabled={pending || (sent ? code.length !== 6 : !EMAIL_RE.test(email))}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {sent ? "Verify" : "Send code"}
        </button>
      </div>
      {devCode && <p className="mt-2 text-xs text-ink-muted">Test mode: code {devCode} (filled in).</p>}
      {error && <p role="alert" className="mt-2 text-sm text-alert">{error}</p>}
    </form>
  );
}
