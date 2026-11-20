"use client";

import { toMobile10 } from "@/lib/utils/phone";
import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn/input-otp";
import { requestCustomerOtpAction, setCustomerNameAction, verifyCustomerOtpAction } from "@/lib/customer-account-actions";
import { completeEmailSignupAction, requestEmailOtpAction, verifyEmailOtpAction } from "@/lib/customer-email-login-actions";
import { LoginMethodToggle, type LoginMethod } from "@/components/account/LoginMethodToggle";
import { cn } from "@/lib/utils/cn";

const EXPO = [0.16, 1, 0.3, 1] as const;

/** Lifted into AccountMenu so typing survives the panel closing and re-opening. */
export type LoginState = {
  /** "phone" = the first screen (number or email, by method); "newphone" = email sign-up asks the mobile number. */
  step: "phone" | "otp" | "newphone" | "name" | "done";
  method: LoginMethod;
  phone: string;
  email: string;
  code: string;
  name: string;
  devCode: string;
};
export const LOGIN_INITIAL: LoginState = { step: "phone", method: "whatsapp", phone: "", email: "", code: "", name: "", devCode: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RESEND_AFTER = 30;

/**
 * Inline login inside the header dropdown: phone → OTP → (first time) name → reload signed in.
 * Uses the same server actions as /login, so rate limits, mock OTP and session cookies behave identically.
 * `onEngage` pins the panel open (no hover-close) once the shopper starts typing.
 */
export function AccountMenuLogin({
  state,
  setState,
  onEngage,
  reduce,
}: {
  state: LoginState;
  setState: (s: LoginState | ((p: LoginState) => LoginState)) => void;
  onEngage: () => void;
  reduce: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);

  const set = (patch: Partial<LoginState>) => setState((p) => ({ ...p, ...patch }));
  const finish = () => {
    set({ step: "done" });
    // The signed-in hint cookie is read once per load; reload so the whole header flips to the account menu.
    setTimeout(() => window.location.reload(), 700);
  };

  const sendOtp = () => {
    setError("");
    start(async () => {
      const r = state.method === "email" ? await requestEmailOtpAction({ email: state.email }) : await requestCustomerOtpAction({ phone: state.phone });
      if (!r.ok) return setError(("error" in r && r.error) || "Could not send OTP.");
      const dev = "devCode" in r ? (r.devCode ?? "") : "";
      set({ step: "otp", code: dev, devCode: dev });
      const t = Date.now();
      setNow(t);
      setResendAt(t + RESEND_AFTER * 1000);
      const tick = setInterval(() => {
        const n = Date.now();
        setNow(n);
        if (n >= t + RESEND_AFTER * 1000) clearInterval(tick);
      }, 1000);
    });
  };

  const verify = (code = state.code) => {
    if (code.length !== 6) return setError("Enter the 6-digit OTP.");
    setError("");
    start(async () => {
      const r = state.method === "email" ? await verifyEmailOtpAction({ email: state.email, code }) : await verifyCustomerOtpAction({ phone: state.phone, code });
      if (!r.ok) return setError(("error" in r && r.error) || "That OTP is incorrect.");
      if ("needsPhone" in r && r.needsPhone) set({ step: "newphone", phone: "" });
      else if ("needsName" in r && r.needsName) set({ step: "name" });
      else finish();
    });
  };

  // Email sign-up: the verified email gets the shopper's mobile number (needed for delivery + updates).
  const savePhone = () => {
    if (state.phone.length !== 10) return setError("Enter your 10-digit mobile number.");
    setError("");
    start(async () => {
      const r = await completeEmailSignupAction({ phone: state.phone });
      if (!r.ok) return setError(r.error);
      if (r.needsName) set({ step: "name" });
      else finish();
    });
  };

  const switchMethod = (method: LoginMethod) => (setError(""), set({ method, code: "", devCode: "" }));
  const canSend = state.method === "email" ? EMAIL_RE.test(state.email.trim()) : state.phone.length === 10;

  const saveName = () => {
    if (state.name.trim().length < 2) return setError("Please enter at least 2 letters.");
    setError("");
    start(async () => {
      const r = await setCustomerNameAction({ name: state.name.trim() });
      if (!r.ok) return setError(r.error);
      finish();
    });
  };

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const step = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EXPO } },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: -12, transition: { duration: 0.12 } },
  };
  const btn =
    "relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest text-sm font-semibold text-white transition-[background-color,transform,opacity] duration-200 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] hover:bg-forest-mid focus-visible:ring-2 focus-visible:ring-forest/40 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:opacity-60";

  return (
    <div className="p-4" onFocusCapture={onEngage}>
      <AnimatePresence mode="wait" initial={false}>
        {state.step === "phone" && (
          <motion.form key="phone" {...step} onSubmit={(e) => (e.preventDefault(), sendOtp())} noValidate>
            <p className="text-[16px] leading-tight font-semibold text-ink">Namaste 🙏</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Log in with an OTP. No password needed.</p>
            <LoginMethodToggle value={state.method} onChange={switchMethod} layoutId="login-method-menu" className="mt-3" />
            {state.method === "whatsapp" ? (
              <label className="mt-2.5 flex h-11 items-center rounded-xl border border-line bg-white transition-[border-color,box-shadow] focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/10">
                <span className="pr-2 pl-3.5 text-sm font-semibold text-ink-muted">+91</span>
                <span className="h-5 w-px bg-line" aria-hidden />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="WhatsApp number"
                  aria-label="WhatsApp number"
                  value={state.phone}
                  maxLength={16}
                  onChange={(e) => set({ phone: toMobile10(e.target.value) })}
                  className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[15px] tracking-wide text-ink tabular-nums outline-none placeholder:tracking-normal placeholder:text-ink-muted/60"
                />
              </label>
            ) : (
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-label="Email address"
                value={state.email}
                maxLength={160}
                onChange={(e) => set({ email: e.target.value.trim() })}
                className="mt-2.5 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10"
              />
            )}
            <button type="submit" disabled={pending || !canSend} className={cn(btn, "mt-2.5")}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Send OTP
            </button>
            <p className="mt-2 text-center text-[11.5px] text-ink-muted">
              {state.method === "whatsapp" ? "The OTP comes on WhatsApp. No WhatsApp? Use Email." : "We'll email you a 6-digit code."}
            </p>
          </motion.form>
        )}

        {state.step === "otp" && (
          <motion.form key="otp" {...step} onSubmit={(e) => (e.preventDefault(), verify())} noValidate>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={state.method === "email" ? "Change email" : "Change number"}
                onClick={() => (setError(""), set({ step: "phone", code: "" }))}
                className="-ml-1 grid size-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ivory hover:text-ink"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[15px] leading-tight font-semibold text-ink">Enter OTP</p>
                <p className="truncate text-[12.5px] text-ink-muted tabular-nums">
                  {state.method === "email" ? `Sent to ${state.email}` : `+91 ${state.phone.slice(0, 5)} ${state.phone.slice(5)} par bheja`}
                </p>
              </div>
            </div>
            <InputOTP
              maxLength={6}
              value={state.code}
              onChange={(v) => set({ code: v.replace(/\D/g, "") })}
              onComplete={(v: string) => verify(v)}
              containerClassName="mt-3 justify-between"
              autoFocus
            >
              <InputOTPGroup className="w-full justify-between">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-11 w-10 rounded-xl border border-line text-base font-semibold first:rounded-xl first:border-l last:rounded-xl data-[active=true]:border-forest data-[active=true]:ring-forest/15"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {state.devCode && <p className="mt-2 text-center text-[11px] text-ink-muted">Test mode: OTP {state.devCode} (auto filled)</p>}
            <button type="submit" disabled={pending || state.code.length !== 6} className={cn(btn, "mt-3")}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Log in
            </button>
            <p className="mt-2 text-center text-[12px] text-ink-muted">
              {wait > 0 ? (
                <span className="tabular-nums">Resend in {wait}s</span>
              ) : (
                <button type="button" onClick={sendOtp} disabled={pending} className="font-semibold text-forest-text underline-offset-4 hover:underline">
                  Resend OTP
                </button>
              )}
            </p>
          </motion.form>
        )}

        {state.step === "newphone" && (
          <motion.form key="newphone" {...step} onSubmit={(e) => (e.preventDefault(), savePhone())} noValidate>
            <p className="text-[16px] leading-tight font-semibold text-ink">Email verified ✓</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Add your mobile number for delivery and order updates.</p>
            <label className="mt-3 flex h-11 items-center rounded-xl border border-line bg-white transition-[border-color,box-shadow] focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/10">
              <span className="pr-2 pl-3.5 text-sm font-semibold text-ink-muted">+91</span>
              <span className="h-5 w-px bg-line" aria-hidden />
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="Mobile number"
                aria-label="Mobile number"
                value={state.phone}
                maxLength={16}
                onChange={(e) => set({ phone: toMobile10(e.target.value) })}
                className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[15px] tracking-wide text-ink tabular-nums outline-none placeholder:tracking-normal placeholder:text-ink-muted/60"
              />
            </label>
            <button type="submit" disabled={pending || state.phone.length !== 10} className={cn(btn, "mt-2.5")}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Continue
            </button>
          </motion.form>
        )}

        {state.step === "name" && (
          <motion.form key="name" {...step} onSubmit={(e) => (e.preventDefault(), saveName())} noValidate>
            <p className="text-[16px] leading-tight font-semibold text-ink">Welcome! 🎉</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">What should we call you?</p>
            <input
              autoFocus
              autoComplete="name"
              placeholder="Your name"
              aria-label="Your name"
              value={state.name}
              maxLength={80}
              onChange={(e) => set({ name: e.target.value })}
              className="mt-3 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10"
            />
            <button type="submit" disabled={pending} className={cn(btn, "mt-2.5")}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Get started
            </button>
            <button type="button" onClick={finish} className="mx-auto mt-2 block text-[12px] text-ink-muted underline-offset-4 hover:underline">
              Later
            </button>
          </motion.form>
        )}

        {state.step === "done" && (
          <motion.div key="done" {...step} className="flex flex-col items-center py-4 text-center">
            <motion.span
              initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { duration: 0.3, ease: EXPO } }}
              className="grid size-11 place-items-center rounded-full bg-forest text-white"
            >
              <Check className="size-5" strokeWidth={2.5} />
            </motion.span>
            <p className="mt-2.5 text-[15px] font-semibold text-ink">You are logged in</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden rounded-lg bg-alert-soft px-3 py-1.5 text-center text-[12px] text-alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {state.step === "phone" && (
        <Link href="/contact" role="menuitem" className="mx-auto mt-3 block w-fit text-[11.5px] font-medium text-ink-muted underline-offset-4 hover:text-forest-text hover:underline">
          Help & support
        </Link>
      )}
    </div>
  );
}
