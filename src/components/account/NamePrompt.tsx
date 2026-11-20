"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setCustomerNameAction } from "@/lib/customer-account-actions";

/**
 * Shown at the top of the account while the profile has no real name (new sign-ups land here
 * straight after the OTP). One field, saved in place; the card disappears once the name is set.
 */
export function NamePrompt() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError("");
      const r = await setCustomerNameAction({ name: name.trim() });
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  return (
    <form
      onSubmit={(e) => (e.preventDefault(), save())}
      className="mb-5 rounded-2xl border border-warm-line bg-warm p-4 md:p-5"
    >
      <p className="text-base font-semibold text-ink">Welcome! What should we call you?</p>
      <p className="mt-0.5 text-sm text-ink-muted">Your name goes on orders, invoices and delivery updates.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Your full name"
          aria-label="Your full name"
          maxLength={80}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10"
        />
        <button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-alert">{error}</p>}
    </form>
  );
}
