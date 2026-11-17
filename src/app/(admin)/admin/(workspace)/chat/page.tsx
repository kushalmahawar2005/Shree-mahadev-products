import { Suspense } from "react";
import { requireRole } from "@/lib/server/admin-auth";
import { connection } from "next/server";
import { ChatAssistantWorkspace } from "@/components/admin/ChatAssistantWorkspace";
import { Skeleton } from "@/components/shadcn/skeleton";
import { geminiEnabled } from "@/lib/server/chat-ai";
import { chatStats, listChatAnswers, listChatLogs } from "@/lib/server/chat-logs";

export const metadata = { title: "Chat assistant" };

export default function ChatAssistantPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-forest-text">Chat assistant</h1>
        <p className="mt-1 text-ink-muted">See what shoppers ask, and teach the assistant answers it is missing.</p>
      </div>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>}>
        <ChatData />
      </Suspense>
    </>
  );
}

async function ChatData() {
  await connection();
  // Shopper conversations: owner / manager only (staff can't read them).
  await requireRole("owner", "manager");
  const [stats, open, recent, answers] = await Promise.all([chatStats(14), listChatLogs("open"), listChatLogs("all", 200), listChatAnswers()]);
  return <ChatAssistantWorkspace stats={stats} openLogs={open} recentLogs={recent} answers={answers} aiOn={geminiEnabled()} />;
}
