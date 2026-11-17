"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { clearOrderAttentionAction } from "@/lib/admin-actions";
import { ConfirmAction } from "./ConfirmAction";

/**
 * Red "needs attention" banner on the admin order page: extra / late payment, refund or shipment with an
 * unclear provider answer, or a cancel request on a paid order. Stays until an admin resolves it with a note.
 */
export function AttentionBanner({ orderId, text, since }: { orderId: number; text: string; since: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 sm:flex-row sm:items-start dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Needs attention{since ? <span className="font-normal opacity-70"> · since {since.slice(0, 16)}</span> : null}</p>
        <ul className="mt-1 space-y-1 text-sm">
          {text.split(" | ").map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
      <ConfirmAction
        trigger={
          <button type="button" disabled={pending} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-red-300 bg-surface px-4 text-sm font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Mark resolved
          </button>
        }
        title="Mark as resolved?"
        description="Only after you've fixed it (refunded the extra payment, checked PayU / NimbusPost, or handled the cancel request). The note goes into the order history."
        confirmLabel="Mark resolved"
        reasonLabel="What did you do?"
        onConfirm={(note) =>
          start(async () => {
            const r = await clearOrderAttentionAction(orderId, note);
            if (!r.ok) return void toast.error(r.error);
            toast.success("Marked resolved");
            router.refresh();
          })
        }
      />
    </div>
  );
}
