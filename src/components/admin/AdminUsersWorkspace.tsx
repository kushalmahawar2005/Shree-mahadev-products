"use client";

import { useState, useTransition } from "react";
import { createAdminInviteAction, removeAdminUserAction } from "@/lib/admin-user-actions";
import { Card, PageHeader, StatusBadge, inputCls } from "./ui";

type User = { id: number; username: string; role: string; lastLoginAt: string | null; createdAt: string };

export function AdminUsersWorkspace({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <><PageHeader title="Admin users" intro="Owner-only access. Invite staff and managers with a 48-hour setup link." />
    <Card title="Invite user"><form className="flex flex-wrap items-end gap-3" action={(form) => start(async () => { try { const result = await createAdminInviteAction({ email: String(form.get("email") ?? ""), role: String(form.get("role") ?? "") }); setInvite(result.token); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not create invite."); } })}>
      <label className="text-sm"><span className="mb-1 block font-semibold">Email</span><input name="email" type="email" required className={inputCls} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Role</span><select name="role" defaultValue="staff" className={inputCls}><option value="staff">Staff</option><option value="manager">Manager</option><option value="owner">Owner</option></select></label>
      <button disabled={pending} className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white">Create invite</button>
    </form>{invite && <p className="mt-3 break-all rounded-xl bg-khaki-soft p-3 text-sm">Share this one-time link: <strong>{`${typeof window !== "undefined" ? window.location.origin : ""}/admin/invite?token=${invite}`}</strong></p>}{error && <p className="mt-3 text-sm text-sale">{error}</p>}</Card>
    <Card title="Current users" className="mt-6"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-line text-ink-muted"><th className="py-2">Username</th><th>Role</th><th>Last login</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-line"><td className="py-3 font-semibold">{user.username}</td><td><StatusBadge>{user.role}</StatusBadge></td><td>{user.lastLoginAt ?? "Never"}</td><td className="text-right"><button type="button" disabled={pending} className="text-red-700 underline" onClick={() => start(async () => { if (!window.confirm(`Remove ${user.username}?`)) return; try { await removeAdminUserAction(user.id); setUsers(users.filter((item) => item.id !== user.id)); } catch (e) { setError(e instanceof Error ? e.message : "Could not remove user."); } })}>Remove</button></td></tr>)}</tbody></table></div></Card>
  </>;
}
