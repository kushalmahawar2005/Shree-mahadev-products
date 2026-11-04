import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { WhatsAppWorkspace } from "@/components/admin/WhatsAppWorkspace";
import { listWhatsAppMessages, listWhatsAppTemplates } from "@/lib/server/whatsapp";
import { requireRole } from "@/lib/server/admin-auth";

export const metadata = { title: "Messages" };
export const instant = false;

export default function MessagesPage() {
  return <><PageHeader title="Messages" intro="WhatsApp automation, templates, opt-outs and delivery status." /><Suspense fallback={<p className="text-ink-muted">Loading messages…</p>}><Data /></Suspense></>;
}

async function Data() {
  await connection();
  await requireRole("owner", "manager");
  const data = { templates: await listWhatsAppTemplates(), messages: await listWhatsAppMessages() };
  return <WhatsAppWorkspace templates={data.templates as { template: string; enabled: number }[]} messages={data.messages as { id: number; template: string; to_phone: string; status: string; created_at: string }[]} />;
}
