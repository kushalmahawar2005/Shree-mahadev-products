"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/lib/admin-login-actions";

const input =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-muted/70 focus:border-forest focus:shadow-[0_0_0_3px_rgba(180,144,36,0.25)] focus:outline-none";

export function LoginFields({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-forest-text">Username</span>
        <input name="username" autoComplete="username" required autoFocus className={input} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-forest-text">Password</span>
        <span className="relative block">
          <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={`${input} pr-16`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-2 my-auto h-9 rounded-lg px-2 text-sm font-semibold text-forest-fg hover:bg-khaki-soft"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-forest px-6 font-semibold text-white transition-colors duration-200 hover:bg-forest-mid disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
