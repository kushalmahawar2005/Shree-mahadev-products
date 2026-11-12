"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Loader2, LogOut, ShieldCheck, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/account/shared";
import {
  logoutOtherSessionsAction,
  logoutSessionAction,
} from "@/lib/account/profile-actions";
import { Badge, SectionCard, btnGhost } from "./parts";

export type SessionView = {
  id: number;
  device: "phone" | "tablet" | "desktop";
  browser: string;
  os: string;
  city: string | null;
  active: string; // "Active now" / "5 min ago" …
  signedIn: string; // formatted date
  current: boolean;
};

const ICON = { phone: Smartphone, tablet: Tablet, desktop: Laptop } as const;

export function SessionsCard({ sessions }: { sessions: SessionView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [, start] = useTransition();
  const others = sessions.filter((s) => !s.current).length;

  const logout = (s: SessionView) => {
    setBusy(s.id);
    start(async () => {
      const r = await logoutSessionAction({ sessionId: s.id });
      setBusy(null);
      if (!r.ok) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      if (r.wasCurrent) {
        toast.success("Logged out");
        router.push("/");
        router.refresh();
        return;
      }
      toast.success(`Logged out of ${s.browser} on ${s.os}`);
      router.refresh();
    });
  };

  return (
    <SectionCard
      id="sessions"
      icon={ShieldCheck}
      title="Security & sessions"
      hint="Devices where you’re signed in. Log out any you don’t recognise."
    >
      <ul className="divide-y divide-line">
        {sessions.map((s) => {
          const Icon = ICON[s.device];
          return (
            <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-co-panel text-ink-muted">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                  {s.browser} on {s.os}
                  {s.current && <Badge tone="success">This device</Badge>}
                </p>
                <p className="text-sm text-ink-muted">
                  {[s.city, s.current ? "Active now" : s.active].filter(Boolean).join(" · ")}
                  <span className="hidden sm:inline"> · Signed in {s.signedIn}</span>
                </p>
              </div>
              <button
                type="button"
                className={btnGhost}
                disabled={busy === s.id}
                onClick={() => logout(s)}
                aria-label={`Log out ${s.browser} on ${s.os}${s.current ? " (this device)" : ""}`}
              >
                {busy === s.id ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                <span className="hidden sm:inline">Log out</span>
              </button>
            </li>
          );
        })}
      </ul>
      {others > 0 && (
        <div className="mt-5 border-t border-line pt-5">
          <button type="button" className={btnGhost} onClick={() => setConfirmAll(true)}>
            <LogOut className="size-4" /> Log out of all other devices
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Log out of all other devices?"
        description={`You’ll stay signed in here. ${others} other device${others === 1 ? "" : "s"} will need an OTP to sign in again.`}
        confirmLabel="Log out others"
        danger
        onConfirm={async () => {
          const r = await logoutOtherSessionsAction();
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(r.count ? `Logged out of ${r.count} device${r.count === 1 ? "" : "s"}` : "No other devices were signed in");
          router.refresh();
        }}
      />
    </SectionCard>
  );
}
