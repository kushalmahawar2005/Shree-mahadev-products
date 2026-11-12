"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { verifyEmailAction } from "@/lib/account/profile-actions";
import { btnPrimary, card } from "./parts";

/** Shown when the page is opened from the verification email (?verify=token). One tap confirms. */
export function VerifyEmailBanner({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="status" className={`${card} flex flex-wrap items-center gap-4 border-co-success/30`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-co-success-soft text-co-success">
        <MailCheck className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">Confirm your email</p>
        <p className="truncate text-sm text-ink-muted">{email || "Your email"}</p>
      </div>
      <button
        type="button"
        className={btnPrimary}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await verifyEmailAction({ token });
            if (!r.ok) toast.error(r.error);
            else toast.success("Email verified");
            router.replace("/account/profile");
            router.refresh();
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Verify email
      </button>
    </div>
  );
}
