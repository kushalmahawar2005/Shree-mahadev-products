"use client";

import { useState, useTransition } from "react";
import { inputCls, Card, StatusBadge, Table } from "@/components/admin/ui";
import { processWhatsAppAction, toggleWhatsAppTemplateAction } from "@/lib/whatsapp-actions";

type Template = { template: string; enabled: number };
type Message = { id: number; template: string; to_phone: string; status: string; created_at: string };

export function WhatsAppWorkspace({ templates, messages }: { templates: Template[]; messages: Message[] }) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState("");
  const run = (fn: () => Promise<unknown>) => start(async () => { try { await fn(); setNotice("Saved."); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save."); } });
  return <div className="space-y-6">
    <Card>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Templates</h2><button disabled={pending} onClick={() => run(processWhatsAppAction)} className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold">Process outbox</button></div>
      <div className="grid gap-3 sm:grid-cols-2">{templates.map((item) => <label key={item.template} className="flex min-h-11 items-center justify-between rounded-xl border border-line px-4 text-sm"><span>{item.template.replaceAll("_", " ")}</span><input type="checkbox" checked={Boolean(item.enabled)} disabled={pending} onChange={(event) => run(() => toggleWhatsAppTemplateAction({ template: item.template, enabled: event.target.checked }))} /></label>)}</div>
      {notice && <p className="mt-4 text-sm text-ink-muted">{notice}</p>}
    </Card>
    <Card><h2 className="mb-4 font-semibold">Delivery log</h2><Table head={["Template", "Phone", "Status", "Created"]}>{messages.map((item) => <tr key={item.id}><td>{item.template}</td><td>{item.to_phone}</td><td><StatusBadge tone={item.status === "sent" ? "green" : item.status === "failed" ? "red" : "amber"}>{item.status}</StatusBadge></td><td>{String(item.created_at)}</td></tr>)}</Table></Card>
    <Card><h2 className="mb-3 font-semibold">Manual opt-out</h2><form action={(form) => run(async () => { const phone = String(form.get("phone") ?? ""); if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Enter a valid 10-digit phone."); const { optOutWhatsAppAction } = await import("@/lib/whatsapp-actions"); await optOutWhatsAppAction({ phone }); })} className="flex flex-col gap-3 sm:flex-row"><input name="phone" inputMode="numeric" placeholder="10-digit phone" className={inputCls} /><button disabled={pending} className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white">Opt out</button></form></Card>
  </div>;
}
