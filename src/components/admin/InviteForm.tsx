"use client";

import { useState, useTransition } from "react";
import { acceptAdminInviteAction } from "@/lib/admin-user-actions";
import { inputCls, Card, PageHeader } from "@/components/admin/ui";

export function InviteForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return <main className="mx-auto max-w-xl p-6"><PageHeader title="Set up admin access" intro="This invitation expires after 48 hours." /><Card><form className="space-y-4" action={(form) => start(async () => { try { await acceptAdminInviteAction({ token, username: String(form.get("username") ?? ""), password: String(form.get("password") ?? "") }); setDone(true); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not accept invite."); } })}><label className="block text-sm font-semibold">Username<input name="username" required className={`${inputCls} mt-1`} /></label><label className="block text-sm font-semibold">Password (12+ characters)<input name="password" type="password" minLength={12} required className={`${inputCls} mt-1`} /></label><button disabled={pending || done} className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white">{done ? "Invite accepted" : "Create account"}</button>{done && <p className="text-sm text-forest-fg">Account created. You can now sign in at /admin/login.</p>}{error && <p className="text-sm text-sale">{error}</p>}</form></Card></main>;
}
