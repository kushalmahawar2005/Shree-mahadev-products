import { connection } from "next/server";
import { Suspense } from "react";
import { WhatsAppWorkspace } from "@/components/admin/WhatsAppWorkspace";
import { Skeleton } from "@/components/shadcn/skeleton";
import { listWhatsAppMessages, listWhatsAppTemplates, whatsappConfigured } from "@/lib/server/whatsapp";
import { requireRole } from "@/lib/server/admin-auth";

export const metadata = { title: "Messages" };
export const instant = false;

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-14 w-64 rounded-2xl bg-surface" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-surface" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl bg-surface" />
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}

async function Data() {
  await connection();
  await requireRole("owner", "manager");
  const [templates, messages] = await Promise.all([listWhatsAppTemplates(), listWhatsAppMessages()]);
  return (
    <WhatsAppWorkspace
      connected={whatsappConfigured()}
      templates={templates.map((t) => ({ template: String(t.template), enabled: Number(t.enabled) }))}
      messages={messages.map((m) => ({
        id: Number(m.id),
        template: String(m.template),
        to_phone: String(m.to_phone),
        status: String(m.status),
        attempts: Number(m.attempts ?? 0),
        error: m.error ? String(m.error) : null,
        created_at: String(m.created_at),
      }))}
    />
  );
}
