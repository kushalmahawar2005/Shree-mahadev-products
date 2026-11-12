"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileLock2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelDeletionAction,
  confirmDeleteAccountAction,
  downloadMyDataAction,
  requestDeleteOtpAction,
} from "@/lib/account/profile-actions";
import { formatPhone } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  Collapse,
  DevCodeNote,
  ErrorNote,
  OtpField,
  SectionCard,
  btnDanger,
  btnGhost,
  field,
  useCountdown,
} from "./parts";

const RESEND_SECONDS = 30;

export function PrivacyCard({
  phone,
  deleteOn,
}: {
  phone: string;
  deleteOn: string | null; // formatted date the account will be deleted, if a request is pending
}) {
  const router = useRouter();
  const [downloading, startDownload] = useTransition();
  const [keeping, startKeep] = useTransition();

  const download = () =>
    startDownload(async () => {
      const r = await downloadMyDataAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your data file is downloading");
    });

  return (
    <SectionCard
      id="privacy"
      icon={FileLock2}
      title="Privacy & data"
      hint="Your data, your call."
    >
      {deleteOn && (
        <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-co-danger/30 bg-co-danger/5 px-4 py-3">
          <p className="text-sm text-ink">
            <span className="font-semibold text-co-danger">Deletion scheduled.</span> Your account will be deleted on {deleteOn}.
          </p>
          <button
            type="button"
            className={btnGhost}
            disabled={keeping}
            onClick={() =>
              startKeep(async () => {
                const r = await cancelDeletionAction();
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                toast.success("Deletion cancelled. Your account stays.");
                router.refresh();
              })
            }
          >
            {keeping && <Loader2 className="size-4 animate-spin" />}
            Keep my account
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">Download my data</p>
          <p className="text-sm text-ink-muted">Profile, addresses, orders and message settings as a JSON file.</p>
        </div>
        <button type="button" className={btnGhost} onClick={download} disabled={downloading}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download
        </button>
      </div>

      {!deleteOn && <DangerZone phone={phone} />}
    </SectionCard>
  );
}

function DangerZone({ phone }: { phone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState("");
  const [resendsLeft, setResendsLeft] = useState(3);
  const [resendAt, setResendAt] = useState(0);
  const [pending, start] = useTransition();
  const wait = useCountdown(resendAt);
  const armed = typed.trim() === "DELETE";

  const sendOtp = () =>
    start(async () => {
      setError("");
      const r = await requestDeleteOtpAction({ confirm: "DELETE" });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSent(true);
      setDevCode(r.devCode);
      setCode(r.devCode ?? "");
      setResendsLeft(r.resendsLeft);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
    });

  const confirm = (value = code) =>
    start(async () => {
      setError("");
      const r = await confirmDeleteAccountAction({ confirm: "DELETE", code: value });
      if (!r.ok) {
        setError(r.error);
        setCode("");
        return;
      }
      toast.success("Deletion requested", {
        description: "Your account will be deleted in 7 days. Sign in again before then to cancel.",
      });
      router.push("/");
      router.refresh();
    });

  const reset = () => {
    setOpen(false);
    setTyped("");
    setSent(false);
    setCode("");
    setError("");
  };

  return (
    <div className="mt-5 rounded-2xl border border-co-danger/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-base font-semibold text-co-danger">
            <AlertTriangle className="size-4" /> Delete my account
          </p>
          <p className="text-sm text-ink-muted">Removes your profile, addresses and saved preferences.</p>
        </div>
        {!open && (
          <button type="button" className={cn(btnGhost, "text-co-danger")} onClick={() => setOpen(true)}>
            <Trash2 className="size-4" /> Delete account
          </button>
        )}
      </div>
      <Collapse show={open}>
        <div className="mt-4 space-y-4 border-t border-co-danger/20 pt-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Your login, saved addresses and message preferences are removed.</li>
            <li>
              Orders and GST invoices are <span className="font-semibold text-ink">kept for 8 years</span>, as Indian tax law requires. They are no longer linked to a login.
            </li>
            <li>You have 7 days to change your mind: just sign in again to cancel.</li>
          </ul>
          {!sent ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (armed) sendOtp();
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">
                  Type <span className="font-mono tracking-wider">DELETE</span> to confirm
                </span>
                <input
                  className={cn(field, "font-mono tracking-wider uppercase")}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.toUpperCase())}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </label>
              <ErrorNote error={error} />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={btnGhost} onClick={reset}>
                  Cancel
                </button>
                <button type="submit" className={btnDanger} disabled={!armed || pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Send OTP to {formatPhone(phone)}
                </button>
              </div>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) confirm();
              }}
            >
              <p className="text-sm text-ink-muted">
                Enter the code sent to <span className="font-semibold text-ink tabular-nums">{formatPhone(phone)}</span>.
              </p>
              <OtpField value={code} onChange={setCode} disabled={pending} invalid={Boolean(error)} />
              <DevCodeNote code={devCode} />
              <ErrorNote error={error} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span aria-live="polite" className="text-sm">
                  {resendsLeft <= 0 ? (
                    <span className="text-ink-muted">No resends left</span>
                  ) : wait > 0 ? (
                    <span className="text-ink-muted tabular-nums">Resend in {wait}s</span>
                  ) : (
                    <button type="button" onClick={sendOtp} disabled={pending} className="inline-flex min-h-11 items-center font-semibold text-forest hover:underline">
                      Resend code ({resendsLeft} left)
                    </button>
                  )}
                </span>
                <div className="flex gap-2">
                  <button type="button" className={btnGhost} onClick={reset} disabled={pending}>
                    Keep account
                  </button>
                  <button type="submit" className={btnDanger} disabled={code.length !== 6 || pending}>
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    Delete my account
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </Collapse>
    </div>
  );
}
