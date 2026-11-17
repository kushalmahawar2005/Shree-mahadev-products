"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn/input-otp";
import { requestCustomerOtpAction, setCustomerNameAction, verifyCustomerOtpAction } from "@/lib/customer-account-actions";
import { cn } from "@/lib/utils/cn";

const EXPO = [0.16, 1, 0.3, 1] as const;

/** Lifted into AccountMenu so typing survives the panel closing and re-opening. */
export type LoginState = { step: "phone" | "otp" | "name" | "done"; phone: string; code: string; name: string; devCode: string };
export const LOGIN_INITIAL: LoginState = { step: "phone", phone: "", code: "", name: "", devCode: "" };

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
      const r = await requestCustomerOtpAction({ phone: state.phone });
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
    if (code.length !== 6) return setError("6 digit ka OTP daalein.");
    setError("");
    start(async () => {
      const r = await verifyCustomerOtpAction({ phone: state.phone, code });
      if (!r.ok) return setError(("error" in r && r.error) || "OTP galat hai.");
      if ("needsName" in r && r.needsName) set({ step: "name" });
      else finish();
    });
  };

  const saveName = () => {
    if (state.name.trim().length < 2) return setError("Kam se kam 2 letters.");
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
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Phone number se login karein, password nahi.</p>
            <label className="mt-3 flex h-11 items-center rounded-xl border border-line bg-white transition-[border-color,box-shadow] focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/10">
              <span className="pr-2 pl-3.5 text-sm font-semibold text-ink-muted">+91</span>
              <span className="h-5 w-px bg-line" aria-hidden />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="Mobile number"
                aria-label="Mobile number"
                value={state.phone}
                maxLength={10}
                onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[15px] tracking-wide text-ink tabular-nums outline-none placeholder:tracking-normal placeholder:text-ink-muted/60"
              />
            </label>
            <button type="submit" disabled={pending || state.phone.length !== 10} className={cn(btn, "mt-2.5")}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              OTP bhejein
            </button>
            <p className="mt-2 text-center text-[11.5px] text-ink-muted">OTP WhatsApp / SMS par aayega</p>
          </motion.form>
        )}

        {state.step === "otp" && (
          <motion.form key="otp" {...step} onSubmit={(e) => (e.preventDefault(), verify())} noValidate>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Number badlein"
                onClick={() => (setError(""), set({ step: "phone", code: "" }))}
                className="-ml-1 grid size-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ivory hover:text-ink"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[15px] leading-tight font-semibold text-ink">OTP daalein</p>
                <p className="text-[12.5px] text-ink-muted tabular-nums">+91 {state.phone.slice(0, 5)} {state.phone.slice(5)} par bheja</p>
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
              Login karein
            </button>
            <p className="mt-2 text-center text-[12px] text-ink-muted">
              {wait > 0 ? (
                <span className="tabular-nums">Dobara bhejein {wait}s mein</span>
              ) : (
                <button type="button" onClick={sendOtp} disabled={pending} className="font-semibold text-forest-text underline-offset-4 hover:underline">
                  OTP dobara bhejein
                </button>
              )}
            </p>
          </motion.form>
        )}

        {state.step === "name" && (
          <motion.form key="name" {...step} onSubmit={(e) => (e.preventDefault(), saveName())} noValidate>
            <p className="text-[16px] leading-tight font-semibold text-ink">Swagat hai! 🎉</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">Aapko kis naam se bulayein?</p>
            <input
              autoFocus
              autoComplete="name"
              placeholder="Aapka naam"
              aria-label="Aapka naam"
              value={state.name}
              maxLength={80}
              onChange={(e) => set({ name: e.target.value })}
              className="mt-3 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10"
            />
            <button type="submit" disabled={pending} className={cn(btn, "mt-2.5")}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Shuru karein
            </button>
            <button type="button" onClick={finish} className="mx-auto mt-2 block text-[12px] text-ink-muted underline-offset-4 hover:underline">
              Baad mein
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
            <p className="mt-2.5 text-[15px] font-semibold text-ink">Login ho gaya</p>
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
