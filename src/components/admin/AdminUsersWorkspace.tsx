"use client";

import { useState, useTransition } from "react";
import { Crown, Link2, Loader2, Shield, Trash2, User as UserIcon, UserPlus } from "lucide-react";
import { createAdminInviteAction, removeAdminUserAction } from "@/lib/admin-user-actions";
import { cn } from "@/lib/utils/cn";
import { ConfirmAction } from "./order/ConfirmAction";
import { CopyButton } from "./order/CopyButton";

type User = { id: number; username: string; role: string; lastLoginAt: string | null; createdAt: string };

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-forest-fg focus:ring-2 focus:ring-forest/15";
const ROLES = {
  owner: { label: "Owner", hint: "Everything, incl. users & settings", icon: Crown, cls: "bg-warm-strong text-sale" },
  manager: { label: "Manager", hint: "Orders, catalog, marketing, reports", icon: Shield, cls: "bg-forest/10 text-forest-fg" },
  staff: { label: "Staff", hint: "Orders and day-to-day work", icon: UserIcon, cls: "bg-khaki-soft text-ink-muted" },
} as const;
const when = (d: string | null) =>
  d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d.replace(" ", "T") + "+05:30")) : "Never signed in";

export function AdminUsersWorkspace({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [invite, setInvite] = useState<string | null>(null);
  const [role, setRole] = useState<keyof typeof ROLES>("staff");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const link = invite ? `${typeof window !== "undefined" ? window.location.origin : ""}/admin/invite?token=${invite}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Admin users</h1>
        <p className="mt-1 text-sm text-ink-muted">Owner-only. Invite staff and managers with a one-time link that works for 48 hours.</p>
      </div>

      <section className={cn(card, "p-4 sm:p-5")}>
        <header className="mb-4 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
            <UserPlus className="size-4" />
          </span>
          <h2 className="font-bold text-forest-text">Invite someone</h2>
        </header>
        <form
          className="space-y-4"
          action={(form) =>
            start(async () => {
              try {
                const result = await createAdminInviteAction({ email: String(form.get("email") ?? ""), role });
                setInvite(result.token);
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not create invite.");
              }
            })
          }
        >
          <label className="block max-w-md">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Email</span>
            <input name="email" type="email" required placeholder="name@example.com" className={input} />
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Role</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((r) => {
                const R = ROLES[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    aria-pressed={role === r}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      role === r ? "border-forest bg-forest/5 ring-2 ring-forest/15" : "border-line hover:bg-subtle",
                    )}
                  >
                    <R.icon className="mt-0.5 size-4 shrink-0 text-forest-fg" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{R.label}</span>
                      <span className="block text-xs text-ink-muted">{R.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Create invite link
          </button>
        </form>
        {invite && (
          <div className="mt-4 rounded-xl border border-warm-line bg-warm p-3">
            <p className="text-xs font-semibold text-sale">Share this one-time link (expires in 48 hours)</p>
            <div className="mt-1 flex items-center gap-1">
              <code className="min-w-0 flex-1 truncate text-xs text-ink">{link}</code>
              <CopyButton value={link} label="invite link" />
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-alert">{error}</p>}
      </section>

      <section className={cn(card, "overflow-hidden")}>
        <header className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 className="font-bold text-forest-text">Team</h2>
          <span className="text-xs text-ink-muted">
            {users.length} user{users.length === 1 ? "" : "s"}
          </span>
        </header>
        <ul className="divide-y divide-line">
          {users.map((u) => {
            const R = ROLES[u.role as keyof typeof ROLES] ?? ROLES.staff;
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-khaki-soft text-sm font-bold text-forest-fg uppercase">{u.username.slice(0, 2)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{u.username}</p>
                  <p className="text-xs text-ink-muted">Last login · {when(u.lastLoginAt)}</p>
                </div>
                <span className={cn("hidden items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex", R.cls)}>
                  <R.icon className="size-3" /> {R.label}
                </span>
                <ConfirmAction
                  trigger={
                    <button type="button" disabled={pending} aria-label={`Remove ${u.username}`} className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-alert-soft hover:text-alert">
                      <Trash2 className="size-4" />
                    </button>
                  }
                  title={`Remove ${u.username}?`}
                  description="They lose admin access right away. You can invite them again later."
                  confirmLabel="Remove user"
                  destructive
                  onConfirm={() =>
                    start(async () => {
                      try {
                        await removeAdminUserAction(u.id);
                        setUsers((list) => list.filter((x) => x.id !== u.id));
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not remove user.");
                      }
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
